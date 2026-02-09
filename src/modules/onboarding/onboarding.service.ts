import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { RedisService } from 'src/common';
import { Env, InjectionToken, RedisConstants } from 'src/common/constants';
import CryptoService from 'src/common/services/crypto.service';
import UtilService from 'src/common/services/utils.service';
import {
  CommonEntityService,
  DepartmentEntityService,
  DepartmentUsersEntityService,
  FormSubmissionEntityService,
  FormsEntityService,
  MediaEntityService,
  OrganizationEntityService,
  UserEntityService,
} from 'src/entities/db';
import { department, users } from 'src/db/schema';
import { Schema } from 'src/types';
import z from 'zod';
import { OnboardingController } from './onboarding.controller';
import { UserContext } from 'src/common/bean';
import { EmailQueueService } from 'src/common/queue/email_queue/email_queue.service';
import { Template } from 'src/common/templates';
import { withResponseCode } from 'src/common/http';
import { MetaAppModule } from '../../app.module';

@Injectable()
export class OnboardingService {
  private readonly REDIS_ONBOARD_DEPARTMENT = 'REDIS_ONBOARD_DEPARTMENT';
  constructor(
    private cryptoService: CryptoService,
    private departmentUsersEntityService: DepartmentUsersEntityService,
    private utils: UtilService,
    private redis: RedisService,
    private userEntityService: UserEntityService,
    @Inject(InjectionToken.DRIZZLE) private db: NodePgDatabase,
    private emailQueue: EmailQueueService,
    private commonEntityService: CommonEntityService,
    private formSubmissionEntityService: FormSubmissionEntityService,
    private departmentEntityService: DepartmentEntityService,
    private formsEntityService: FormsEntityService,
    private mediaEntityService: MediaEntityService,
    private organizationEntityService: OrganizationEntityService,
  ) {}

  private getRedisOnboardKey(email: string) {
    return RedisService.joinKeys(email, this.REDIS_ONBOARD_DEPARTMENT);
  }

  async initializeOnboardingUser(
    userContext: UserContext,
    body: z.infer<typeof OnboardingController.create>,
  ) {
    const user = userContext.value.user;
    if (!userContext.hasDepartmentAccess(body.departmentId)) {
      throw new ForbiddenException(
        `You dont have access to department : ${body.departmentId}`,
      );
    }
    const id = Date.now().toString();
    const isDev = UtilService.isDevelopment() && body.isDev;
    const finalResponse: Array<{ email: string; link: string }> = [];
    const payload = body.emails.map((email) => {
      const emailPayload = {
        email,
        id,
        departmentId: body.departmentId,
        orgId: user.orgId,
      };
      const link = UtilService.appendQueryParamToUrl(body.redirect, {
        q: this.cryptoService.encryptEncodeDataForLink(emailPayload),
      });
      !isDev &&
        this.emailQueue.addJob({
          to: email,
          html: Template.Email.onboardUserDepartment.render(link),
          from: Env.domainEmail,
          subject: 'Onboarding request',
        });
      finalResponse.push({ link, email });
      //migrate to hmac later or do we ? :-/
      this.redis.setTTL(
        RedisConstants.Keys.EMAIL_VERIFICATION,
        this.getRedisOnboardKey(email),
        emailPayload,
        42300, //12H
      );
    });
    if (isDev) return finalResponse;
    return withResponseCode(HttpStatus.OK).success();
  }

  async onboardUser(body: z.infer<typeof OnboardingController.onboardUser>) {
    const decryptedData = this.cryptoService.decryptDecodeDataForLink(
      OnboardingController.onboardPayloadDecrpytedPayload,
      body.v,
    );
    if (!decryptedData) throw new ForbiddenException('Link expired.');
    const resp = await this.redis.getUnknown(
      RedisConstants.Keys.EMAIL_VERIFICATION,
      this.getRedisOnboardKey(decryptedData.email),
      OnboardingController.onboardPayloadDecrpytedPayload,
    );
    if (!resp || resp.id !== decryptedData.id) {
      throw new ForbiddenException('Link expired');
    }
    this.redis.del(
      RedisConstants.Keys.EMAIL_VERIFICATION,
      this.getRedisOnboardKey(decryptedData.email),
    );
    try {
      await this.commonEntityService.onboardUserToDepartment({
        departmentId: resp.departmentId,
        email: resp.email,
        orgId: resp.orgId,
        password: this.cryptoService.gethash(body.password),
      });
      return withResponseCode(HttpStatus.OK).success();
    } catch (err) {
      throw new InternalServerErrorException();
    }
  }

  async updateUserInfo(
    userContext: UserContext,
    payload: z.infer<typeof OnboardingController.updateFormData>,
  ) {
    const user = userContext.value.user;

    // admin → allow
    // non-admin with permission → allow
    // non-admin without permission → only allow self-update
    if (!user.isAdmin) {
      const hasPermission = userContext.hasPermissionByName(
        `${MetaAppModule.name}:${MetaAppModule.permissions.UPDATE_USER_PROFILE}`,
      );
      if (!hasPermission && user.id !== payload.userId) {
        throw new ForbiddenException(
          'You dont have access to update this user',
        );
      }
    }
    // Pre-flight: check media uploads before entering transaction
    if (payload.departmentId) {
      const existingFsId =
        await this.departmentUsersEntityService.getFormSubmission(
          payload.userId,
          payload.departmentId,
        );
      if (existingFsId) {
        await this.mediaEntityService.ensureNoUploadsInProgress(existingFsId, undefined, { orgId: user.orgId });
      }
    }

    return await this.db.transaction(async (tx) => {
      const targetUser = await this.userEntityService.getByOrgId(
        { id: payload.userId, orgId: user.orgId },
        { db: tx, throw: true },
      );

      const updates: Record<string, unknown> = {};

      if (payload.email) {
        updates.email = payload.email;
      }
      if (payload.password) {
        updates.password = this.cryptoService.gethash(payload.password);
      }

      if (Object.keys(updates).length > 0) {
        await tx.update(users).set(updates).where(eq(users.id, targetUser.id));
      }

      let submission: Schema.FormSubmission | null = null;

      if (payload.departmentId && payload.data) {
        const dept = await this.departmentEntityService.getById(
          { user, id: payload.departmentId },
          { db: tx, throw: true },
        );

        let departmentFormId = dept!.departmentFormId;

        // create form for department if it doesn't exist
        if (!departmentFormId) {
          const form = await this.formsEntityService.createForm(
            { name: 'Department Form', content: payload.data },
            { db: tx, throw: true, orgId: user.orgId },
          );
          await tx
            .update(department)
            .set({ departmentFormId: form.id })
            .where(eq(department.id, dept!.id));
          departmentFormId = form.id;
        }

        const existingFsId =
          await this.departmentUsersEntityService.getFormSubmission(
            targetUser.id,
            payload.departmentId,
            tx,
          );

        if (!existingFsId) {
          submission = await this.formSubmissionEntityService.create(
            { formId: departmentFormId, data: payload.data, updatedBy: user.id },
            { db: tx, throw: true, orgId: user.orgId },
          );
          await this.departmentUsersEntityService.setFormSubmission(
            targetUser.id,
            payload.departmentId,
            submission.id,
            tx,
          );
        } else {
          submission = await this.formSubmissionEntityService.update(
            existingFsId,
            { formId: departmentFormId, data: payload.data, updatedBy: user.id },
            { db: tx, throw: true, orgId: user.orgId },
          );
        }
      }

      return withResponseCode(HttpStatus.OK).item({
        user: targetUser,
        ...(submission && { submission }),
      });
    });
  }

  async updateUserProfile(
    userContext: UserContext,
    payload: z.infer<typeof OnboardingController.updateUserProfileSchema>,
  ) {
    const user = userContext.value.user;

    // No userId → self-update; userId provided → must be admin
    const targetUserId = payload.userId ?? user.id;
    if (payload.userId && !user.isAdmin) {
      throw new ForbiddenException(
        'Only admins can update other users profiles',
      );
    }
    const isAdmin = user.isAdmin;

    // Get org → check profileForm exists
    const org = await this.organizationEntityService.getOrg(user, {
      throw: true,
    });
    if (!org.profileForm) {
      throw new BadRequestException(
        'Profile form not configured for this organization',
      );
    }

    // Get the form to read additionalInfo
    const form = await this.formsEntityService.getFormById(org.profileForm, {
      throw: true,
      orgId: user.orgId,
    });

    // Parse forbidden fields list (used for non-admin filtering)
    let forbidden: string[] = [];
    if (!isAdmin) {
      const forbiddenSchema = z.object({ forbiddenFields: z.string() });
      const parsed = forbiddenSchema.safeParse(form.additionalInfo);
      if (parsed.success) {
        forbidden = parsed.data.forbiddenFields
          .split(',')
          .map((f) => f.trim());
      }
    }

    // Transaction: create or update formSubmission, link to user
    return await this.db.transaction(async (tx) => {
      const targetUser = await this.userEntityService.getByOrgId(
        { id: targetUserId, orgId: user.orgId },
        { db: tx, throw: true },
      );

      // For non-admin: strip forbidden fields from payload, but preserve
      // existing forbidden field values so admin-set data isn't wiped on upsert
      let finalData: Record<string, unknown> = payload.formData;
      if (!isAdmin && forbidden.length > 0) {
        const userAllowedData = Object.fromEntries(
          Object.entries(payload.formData).filter(
            ([key]) => !forbidden.includes(key),
          ),
        );
        let existingForbiddenData: Record<string, unknown> = {};
        if (targetUser.userInfo) {
          const existing = await this.formSubmissionEntityService.getById(
            targetUser.userInfo,
            { db: tx, throw: false, orgId: user.orgId },
          );
          if (existing?.data && typeof existing.data === 'object') {
            existingForbiddenData = Object.fromEntries(
              Object.entries(existing.data as Record<string, unknown>).filter(
                ([key]) => forbidden.includes(key),
              ),
            );
          }
        }
        finalData = { ...existingForbiddenData, ...userAllowedData };
      }

      let submission: Schema.FormSubmission;

      if (!targetUser.userInfo) {
        // Create new submission
        submission = await this.formSubmissionEntityService.create(
          {
            formId: org.profileForm!,
            data: finalData,
            updatedBy: user.id,
          },
          { db: tx, throw: true, orgId: user.orgId },
        );
        // Link to user
        await this.userEntityService.updateUserInfo(
          {
            userId: targetUser.id,
            formSubmissionId: submission.id,
            keyType: 'userInfo',
          },
          { db: tx, throw: true },
        );
      } else {
        // Update existing submission
        submission = await this.formSubmissionEntityService.update(
          targetUser.userInfo,
          {
            formId: org.profileForm!,
            data: finalData,
            updatedBy: user.id,
          },
          { db: tx, throw: true, orgId: user.orgId },
        );
      }

      return withResponseCode(HttpStatus.OK).item({
        user: targetUser,
        submission,
      });
    });
  }

  async getUserProfile(
    userContext: UserContext,
    userId: string,
    departmentId?: string,
  ) {
    const user = userContext.value.user;

    // admin → allow
    // non-admin with permission → allow
    // non-admin without permission → only allow self
    if (!user.isAdmin) {
      const hasPermission = userContext.hasPermissionByName(
        `${MetaAppModule.name}:${MetaAppModule.permissions.UPDATE_USER_PROFILE}`,
      );
      if (!hasPermission && user.id !== userId) {
        throw new ForbiddenException(
          'You dont have access to view this user profile',
        );
      }
    }

    const targetUser = await this.userEntityService.getByOrgId(
      { id: userId, orgId: user.orgId },
      { throw: true },
    );

    // Remove password from response
    const { password, ...userWithoutPassword } = targetUser;

    let departmentInfo: Schema.FormSubmission | null = null;

    if (departmentId) {
      const fsId =
        await this.departmentUsersEntityService.getFormSubmission(
          userId,
          departmentId,
        );
      if (fsId) {
        departmentInfo = await this.formSubmissionEntityService.getById(fsId, {
          throw: false,
          orgId: user.orgId,
        });
      }
    }

    return withResponseCode(HttpStatus.OK).item({
      user: userWithoutPassword,
      departmentInfo,
    });
  }

  async getUsersList(
    userContext: UserContext,
    emailPrefix: string,
    paginatedArg: any,
  ) {
    const user = userContext.value.user;

    return this.userEntityService.getUsersByEmailPrefix(
      user,
      emailPrefix,
      paginatedArg,
      userContext.value.departments?.children ?? [],
    );
  }

  async updateUserPassword(
    userContext: UserContext,
    body: z.infer<typeof OnboardingController.updatePasswordSchema>,
  ) {
    const currentUser = userContext.value.user;
    const targetUser = await this.userEntityService.getByOrgId(
      { id: body.userId, orgId: currentUser.orgId },
      { throw: true },
    );

    await this.userEntityService.updatePasswordByEmail(
      {
        email: targetUser.email,
        password: this.cryptoService.gethash(body.password),
      },
      { throw: true },
    );

    return withResponseCode(HttpStatus.OK).success();
  }

  async createUserDirect(
    userContext: UserContext,
    body: z.infer<typeof OnboardingController.createUserSchema>,
  ) {
    const currentUser = userContext.value.user;

    await this.commonEntityService.onboardUserToDepartment({
      email: body.email.toLowerCase().trim(),
      password: this.cryptoService.gethash(body.password),
      orgId: currentUser.orgId,
      departmentId: body.departmentId,
    });

    return withResponseCode(HttpStatus.CREATED).success();
  }
}

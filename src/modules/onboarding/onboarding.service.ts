import {
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
  UserEntityService,
} from 'src/entities/db';
import { department, users } from 'src/db/schema';
import { Schema } from 'src/types';
import z from 'zod';
import { OnboardingController } from './onboarding.controller';
import { ControllerResponse, UserContext } from 'src/common/bean';
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
    return ControllerResponse.Success;
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
      return ControllerResponse.Success;
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
      const hasPermission = userContext.hasPermission(
        MetaAppModule.permissions.UPDATE_USER_PROFILE,
      );
      if (!hasPermission && user.id !== payload.userId) {
        throw new ForbiddenException(
          'You dont have access to update this user',
        );
      }
    }

    return await this.db.transaction(async (tx) => {
      const targetUser = await this.userEntityService.getByOrgId(
        { id: payload.userId, orgId: user.orgId },
        { db: tx, throw: true },
      );

      // Block update if media is still uploading for this form submission
      if (targetUser.departmentInfoId) {
        await this.mediaEntityService.ensureNoUploadsInProgress(targetUser.departmentInfoId);
      }

      const updates: Record<string, unknown> = {};

      if (payload.email) {
        updates.email = payload.email;
      }
      if (payload.password) {
        updates.password = this.cryptoService.gethash(payload.password);
      }

      if (Object.keys(updates).length > 0) {
        await tx
          .update(users)
          .set(updates)
          .where(eq(users.id, targetUser.id));
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
            { db: tx, throw: true },
          );
          await tx
            .update(department)
            .set({ departmentFormId: form.id })
            .where(eq(department.id, dept!.id));
          departmentFormId = form.id;
        }

        if (!targetUser.departmentInfoId) {
          submission = await this.formSubmissionEntityService.create(
            { formId: departmentFormId, data: payload.data },
            { db: tx, throw: true },
          );
          await this.userEntityService.updateUserInfo(
            {
              userId: targetUser.id,
              formSubmissionId: submission.id,
              keyType: 'departmentInfoId',
            },
            { db: tx, throw: true },
          );
        } else {
          submission = await this.formSubmissionEntityService.update(
            targetUser.departmentInfoId,
            { formId: departmentFormId, data: payload.data },
            { db: tx, throw: true },
          );
        }
      }

      return withResponseCode(HttpStatus.OK).item({
        user: targetUser,
        ...(submission && { submission }),
      });
    });
  }

  async getUserProfile(userContext: UserContext, userId: string) {
    const user = userContext.value.user;

    // admin → allow
    // non-admin with permission → allow
    // non-admin without permission → only allow self
    if (!user.isAdmin) {
      const hasPermission = userContext.hasPermission(
        MetaAppModule.permissions.UPDATE_USER_PROFILE,
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

    if (targetUser.departmentInfoId) {
      departmentInfo = await this.formSubmissionEntityService.getById(
        targetUser.departmentInfoId,
        { throw: false },
      );
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
}

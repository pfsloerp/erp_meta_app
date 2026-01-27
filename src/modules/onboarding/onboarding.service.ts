import {
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { RedisService } from 'src/common';
import { Env, InjectionToken, RedisConstants } from 'src/common/constants';
import CryptoService from 'src/common/services/crypto.service';
import UtilService from 'src/common/services/utils.service';
import {
  CommonEntityService,
  DepartmentUsersEntityService,
  FormSubmissionEntityService,
  UserEntityService,
} from 'src/entities/db';
import { Schema } from 'src/types';
import z from 'zod';
import { OnboardingController } from './onboarding.controller';
import { ControllerResponse, UserContext } from 'src/common/bean';
import { EmailQueueService } from 'src/common/queue/email_queue/email_queue.service';
import { Template } from 'src/common/templates';
import { withResponseCode } from 'src/common/http';

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
    // private snsService: SnsService,
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

  async updateProfile(
    currentUser: Schema.Users,
    payload: z.infer<typeof OnboardingController.updateProfile>,
  ) {
    const user = currentUser;
    if (!user.userInfo) {
      return this.db.transaction(async (tx) => {
        const submission = await this.formSubmissionEntityService.create(
          {
            formId: payload.formId,
            data: payload.data,
          },
          { db: tx, throw: true },
        );

        const updatedUser = await this.userEntityService.updateUserInfo(
          user.id,
          submission.id,
          { db: tx, throw: true },
        );

        return withResponseCode(HttpStatus.OK).item({
          user: updatedUser,
          submission,
        });
      });
    }

    const updatedSubmission = await this.formSubmissionEntityService.update(
      user.userInfo,
      {
        formId: payload.formId,
        data: payload.data,
      },
      { throw: false },
    );

    if (!updatedSubmission)
      throw new NotFoundException('Form submission not found');

    return withResponseCode(HttpStatus.OK).item({
      user: user,
      submission: updatedSubmission,
    });
  }
}

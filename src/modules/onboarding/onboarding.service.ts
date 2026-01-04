import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { RedisService } from 'src/common';
import { InjectionToken, RedisConstants } from 'src/common/constants';
import CryptoService from 'src/common/services/crypto.service';
import UtilService from 'src/common/services/utils.service';
import {
  DepartmentUsersEntityService,
  UserEntityService,
} from 'src/entities/db';
import { Schema } from 'src/types';
import z from 'zod';
import { OnboardingController } from './onboarding.controller';
import { UserContext } from 'src/common/bean';

@Injectable()
export class OnboardingService {
  constructor(
    private cryptoService: CryptoService,
    private departmentUsersEntityService: DepartmentUsersEntityService,
    private utils: UtilService,
    private redis: RedisService,
    private userEntityService: UserEntityService,
    @Inject(InjectionToken.DRIZZLE) private db: NodePgDatabase,
    // private snsService: SnsService,
  ) {}

  async initializeOnboardingUser(
    userContext: UserContext,
    body: z.infer<typeof OnboardingController.create>,
    devForce?: boolean,
  ) {
    const user = userContext.value.user;
    let allowedEmails = Array.from(new Set(body.emails));
    if (!userContext.hasDepartmentAccess(body.departmentId)) {
      throw new ForbiddenException(
        `You dont have access to department : ${body.departmentId}`,
      );
    }
    // if (UtilService.isProduction()) {
    //   const throttledEmails = await Promise.all(
    //     allowedEmails.map(async (v) => {
    //       const { allowed } = await this.redis.throttle(
    //         this.redis.joinKey(RedisConstants.Keys.THROTTLE_EMAIL, v),
    //         10,
    //         600,
    //       );
    //       if (!allowed) return null;
    //       return v;
    //     }),
    //   );
    //   allowedEmails = throttledEmails.filter(Boolean) as string[];
    //   if (allowedEmails.length === 0) return;
    // }
    const timestamp = Date.now();
    const encryptedPayload = allowedEmails.map((email) => {
      const identifier = {
        timestamp,
        id: UtilService.uuidV4(),
      };
      return {
        ...identifier,
        data: encodeURIComponent(
          this.cryptoService.encrypt(
            JSON.stringify({
              departmentId: body.departmentId,
              email,
              orgId: user.orgId,
              ...identifier,
            }),
          ),
        ),
      };
    });
    // if (UtilService.isProduction()) {
    //   // this.snsService.publish() TODO
    //   return;
    // } else
    if (devForce) {
      await Promise.all(
        encryptedPayload.map((payload) =>
          this.onboardUser(decodeURIComponent(payload.data), 'Password1!'),
        ),
      );
      return;
    }
    return {
      message: encryptedPayload,
    };
  }

  async onboardUser(payload: string, password: string) {
    try {
      const resp =
        OnboardingController.onboardPayloadDecrpytedPayload.safeParse(
          JSON.parse(this.cryptoService.decrypt(payload)) as z.infer<
            typeof OnboardingController.onboardPayloadDecrpytedPayload
          >,
        );
      if (!resp.success) {
        throw new Error();
      }
      return await this.db.transaction(async (tx) => {
        const [user] = await this.userEntityService.create(
          {
            email: resp.data.email,
            password: password,
            orgId: resp.data.orgId,
          },
          tx,
        );
        if (!user) throw new Error('');
        await this.departmentUsersEntityService.onboardUserToDepartment(
          resp.data.departmentId,
          user.id,
          tx,
        );
        return user;
      });
    } catch (e) {
      console.log(e);
      throw new ForbiddenException('Invalid payload');
    }
  }
}

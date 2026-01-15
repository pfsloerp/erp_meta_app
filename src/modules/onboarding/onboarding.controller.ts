import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RedisService, SchemaPipe } from 'src/common';
import { HeaderConstants, ZodConstants } from 'src/common/constants';
import { GetRoute } from 'src/common/decorators';
import z from 'zod';
import { OnboardingService } from './onboarding.service';

@Controller('api/meta-app/onboard')
export class OnboardingController {
  constructor(
    private onboardingService: OnboardingService,
    private redis: RedisService,
  ) {}

  static readonly onboardPayloadDecrpytedPayload = z.object({
    email: z.email().nonempty(),
    departmentId: z.int(),
    id: z.string().nonempty(),
    orgId: z.int(),
  });

  static readonly onboardUser = z.object({
    password: ZodConstants.password(),
    q: z.string(),
  });

  static readonly create = z
    .object({
      departmentId: z.number(),
      emails: z.array(z.email()).max(30).min(1),
      isDev: z.boolean().optional(),
      redirect: z.string(),
    })
    .refine((data) => new Set(data.emails).size === data.emails.length, {
      message: 'Emails must be non-empty and unique',
      path: ['emails'],
    });
  @Post('register')
  startOnboarding(
    @Body(SchemaPipe.inject(OnboardingController.create))
    body: z.infer<typeof OnboardingController.create>,
    @Req() request: Request,
    @GetRoute() route: string,
  ) {
    return this.redis.customTTL(
      () =>
        this.onboardingService.initializeOnboardingUser(
          request.beans.UserContext!,
          body,
        ),
      [
        route,
        body.departmentId.toString(),
        request.headers[HeaderConstants.X_FORWARDED_FOR] as string,
      ],
      10,
    );
  }
  @Post('action')
  onboardUser(
    @Body(SchemaPipe.inject(OnboardingController.onboardUser))
    body: z.infer<typeof OnboardingController.onboardUser>,
  ) {
    this.onboardingService.onboardUser(body);
  }
}

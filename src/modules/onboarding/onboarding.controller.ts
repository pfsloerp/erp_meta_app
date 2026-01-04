import { Body, Controller, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SchemaPipe } from 'src/common';
import { ZodConstants } from 'src/common/constants';
import z from 'zod';
import { OnboardingService } from './onboarding.service';
import { MetaAppModule } from '../../app.module';

@Controller('api/meta-app/onboard')
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}
  static readonly create = z.object({
    departmentId: z.number(),
    emails: z.array(z.email()),
  });

  static readonly onboardPayloadDecrpytedPayload = z.object({
    email: z.email().nonempty(),
    departmentId: z.int(),
    id: z.string().nonempty(),
    timestamp: z.int().nonnegative(),
    orgId: z.int(),
  });

  static readonly onboardUser = z.object({
    password: ZodConstants.password(),
  });

  @Post('register')
  startOnboarding(
    @Req() request: Request,
    @Body(SchemaPipe.inject(OnboardingController.create))
    body: z.infer<typeof OnboardingController.create>,
    @Query('devForce') devForce: string,
  ) {
    return this.onboardingService.initializeOnboardingUser(
      request.beans.UserContext!,
      body,
      !!devForce,
    );
  }
  @Post('action')
  onboardUser(
    @Req() request: Request,
    @Body(SchemaPipe.inject(OnboardingController.onboardUser))
    body: z.infer<typeof OnboardingController.onboardUser>,
    @Query('q') encryptedData: string,
  ) {
    return this.onboardingService.onboardUser(
      decodeURIComponent(encryptedData),
      body.password,
    );
  }
}

import { Module } from '@nestjs/common';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AssignDepartmentModule } from './assign-department/assign-department.module';

@Module({
  imports: [OnboardingModule, PermissionsModule, AssignDepartmentModule],
})
export class MetaAppCoreModule {}

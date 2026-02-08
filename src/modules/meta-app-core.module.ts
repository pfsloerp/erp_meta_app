import { Module } from '@nestjs/common';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AssignDepartmentModule } from './assign-department/assign-department.module';
import { ManageUserAccessModule } from './manage-user-access/manage-user-access.module';

@Module({
  imports: [
    OnboardingModule,
    PermissionsModule,
    AssignDepartmentModule,
    ManageUserAccessModule,
  ],
})
export class MetaAppCoreModule {}

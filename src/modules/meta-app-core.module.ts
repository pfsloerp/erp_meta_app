import { Module } from '@nestjs/common';
import { AssignDepartmentModule } from './assign-department/assign-department.module';
import { MetaAppFormsModule } from './forms/forms.module';
import { ManageUserAccessModule } from './manage-user-access/manage-user-access.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PermissionsModule } from './permissions/permissions.module';

@Module({
  imports: [
    OnboardingModule,
    PermissionsModule,
    AssignDepartmentModule,
    ManageUserAccessModule,
    MetaAppFormsModule,
  ],
})
export class MetaAppCoreModule {}

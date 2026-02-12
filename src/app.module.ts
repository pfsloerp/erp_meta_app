import { Module } from '@nestjs/common';
import { UserContext } from 'src/common/bean';
import { InstalledApp } from 'src/types/apps.type';
import { MetaAppCoreModule } from './modules/meta-app-core.module';

@Module({
  imports: [MetaAppCoreModule],
})
export class MetaAppModule {
  static readonly registeredRoutes = {
    onboardUser: 'api/meta-app/onboard/register',
    updatePassword: 'api/meta-app/onboard/update-password',
    createUser: 'api/meta-app/onboard/create-user',
    updateProfile: 'api/meta-app/onboard/update-user-profile-data',
    getProfile: 'api/meta-app/onboard/user-profile-data',
    getUsersList: 'api/meta-app/onboard/users',
    app: 'api/meta-app/app',
    permissions: 'api/meta-app/permissions',
    assignDepartment: 'api/assign-department',
    manageUserAccess: 'api/meta-app/manage-user-access',
    forms: 'api/meta-app/forms',
    updateUserProfile: 'api/meta-app/onboard/update-user-profile',
  };

  static readonly name = 'META_APP';
  static readonly permissions = {
    REGISTER_USER: 'REGISTER_USER',
    MANAGE_PERMISSIONS: 'MANAGE_PERMISSIONS',
    DEPARTMENT_ASSIGN_CHILDREN_USERS: 'DEPARTMENT_ASSIGN_CHILDREN_USERS',
    UPDATE_USER_PROFILE: 'UPDATE_USER_PROFILE',
    MANAGE_USER_ACCESS: 'MANAGE_USER_ACCESS',
    GET_USERS: 'GET_USERS',
    MANAGE_FORMS: 'MANAGE_FORMS',
  } as const;

  static readonly middlewares = {
    guards: [
      {
        route: `${MetaAppModule.registeredRoutes.onboardUser}`,
        apply: (user: UserContext) => ({
          isAdmin: true,
          permissions: [MetaAppModule.permissions.REGISTER_USER],
          message: "You don't have access to add users",
        }),
      },
      {
        route: `${MetaAppModule.registeredRoutes.updatePassword}`,
        apply: (user: UserContext) => ({
          isAdmin: true,
          permissions: [MetaAppModule.permissions.REGISTER_USER],
          message: "You don't have access to update password",
        }),
      },
      {
        route: `${MetaAppModule.registeredRoutes.createUser}`,
        apply: (user: UserContext) => ({
          isAdmin: true,
          permissions: [MetaAppModule.permissions.REGISTER_USER],
          message: "You don't have access to add users",
        }),
      },
      {
        route: `${MetaAppModule.registeredRoutes.permissions}/user/:userId/:action/permission/:permissionId`,
        apply: (user: UserContext) => ({
          isAdmin: true,
          permissions: [MetaAppModule.permissions.MANAGE_PERMISSIONS],
          message: "You don't have access to manage permissions",
        }),
      },
      {
        route: MetaAppModule.registeredRoutes.assignDepartment,
        apply: (user: UserContext) => ({
          isAdmin: true,
          permissions: [MetaAppModule.permissions.DEPARTMENT_ASSIGN_CHILDREN_USERS],
          message: "You don't have access to manage department for users",
        }),
      },
      {
        route: MetaAppModule.registeredRoutes.getUsersList,
        apply: (user: UserContext) => ({
          isAdmin: true,
          permissions: [MetaAppModule.permissions.GET_USERS],
        }),
      },
      {
        route: MetaAppModule.registeredRoutes.manageUserAccess,
        apply: (user: UserContext) => ({
          isAdmin: true,
          permissions: [MetaAppModule.permissions.MANAGE_USER_ACCESS],
          message: "You don't have access to manage user access",
        }),
      },
      {
        route: MetaAppModule.registeredRoutes.forms,
        apply: (user: UserContext) => ({
          isAdmin: true,
          permissions: [MetaAppModule.permissions.MANAGE_FORMS],
          message: "You don't have access to manage forms",
        }),
      },
    ],
  } satisfies InstalledApp['middlewares'];
}

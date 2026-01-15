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
    app: 'api/meta-app/app',
    permissions: 'api/meta-app/permissions',
    assignDepartment: 'api/assign-department',
  };

  static readonly name = 'META_APP';
  static readonly permissions = {
    REGISTER_USER: 'REGISTER_USER',
    MANAGE_PERMISSIONS: 'MANAGE_PERMISSIONS',
    DEPARTMENT_ASSIGN_CHILDREN_USERS: 'DEPARTMENT_ASSIGN_CHILDREN_USERS',
  } as const;

  private static get allDefaultRoutes() {
    return Object.values(MetaAppModule.registeredRoutes);
  }

  static readonly middlewares = {
    auth: MetaAppModule.allDefaultRoutes,
    initializeUserData: MetaAppModule.allDefaultRoutes,
    verifyPermissionsOnDemand: [
      {
        route: `${MetaAppModule.registeredRoutes.onboardUser}`,
        apply: (user: UserContext) => ({
          isAdmin: true,
          allowedPermissions: [
            `${MetaAppModule.name}:${MetaAppModule.permissions.REGISTER_USER}`,
          ],
          message: "You don't have access to add users",
        }),
      },
      {
        route: `${MetaAppModule.registeredRoutes.permissions}/user/:userId/:action/permission/:permissionId`,
        apply: (user: UserContext) => ({
          isAdmin: true,
          allowedPermissions: [
            `${MetaAppModule.name}:${MetaAppModule.permissions.MANAGE_PERMISSIONS}`,
          ],
          message: "You don't have access to manage permissions",
        }),
      },
      {
        route: MetaAppModule.registeredRoutes.assignDepartment,
        apply: (user: UserContext) => ({
          isAdmin: true,
          allowedPermissions: [
            `${MetaAppModule.name}:${MetaAppModule.permissions.DEPARTMENT_ASSIGN_CHILDREN_USERS}`,
          ],
          message: "You don't have access to manage department for users",
        }),
      },
    ],
  } satisfies InstalledApp<
    typeof MetaAppModule.name,
    typeof MetaAppModule.permissions,
    typeof MetaAppModule.registeredRoutes
  >['middlewares'];
}

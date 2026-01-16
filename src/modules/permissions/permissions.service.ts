import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ControllerResponse, UserContext } from 'src/common/bean';
import {
  AppEntityService,
  PermissionEntityService,
  RolesEntityService,
  DepartmentEntityService,
  UserEntityService,
  CommonEntityService,
} from 'src/entities/db';
import { Schema } from 'src/types';
import { PermissionsController } from './permissions.controller';

@Injectable()
export class PermissionsService {
  constructor(
    private appEntityServbice: AppEntityService,
    private rolesEntityService: RolesEntityService,
    private userEntityService: UserEntityService,
    private departmentEntityService: DepartmentEntityService,
    private permissionEntityService: PermissionEntityService,
    private commonEntityService: CommonEntityService,
  ) {}

  async updatePermission(
    user: Schema.Users,
    userContext: UserContext,
    userId: string,
    permissionId: string,
    action,
  ) {
    if (
      ![
        PermissionsController.PermissionAction.Add,
        PermissionsController.PermissionAction.Remove,
      ].includes(action) ||
      user.id === userId
    ) {
      throw new BadRequestException('Invalid permission action');
    }
    const isRemove = action === PermissionsController.PermissionAction.Remove;
    const targetUser = await this.userEntityService.getById(userId);

    //ignore if target user is admin - we gonna use VPN protected routes for it
    if (!targetUser || targetUser.orgId != user.orgId || targetUser.isAdmin)
      throw new BadRequestException('Cannot perform action on this user');

    if (!userContext.hasPermission(permissionId)) {
      throw new ForbiddenException('You dont have this permission');
    }

    if (user.isAdmin) {
      return this.updatePermissionForUser(isRemove, permissionId, userId, user);
    }

    const [accessAllowed, targetDepartmentId] =
      await this.commonEntityService.isUserAccessible(userContext, targetUser);

    if (!accessAllowed) {
      throw new ForbiddenException(
        'You dont have access to this department, Please contact Admin',
      );
    }

    const hasDepartmentAppAccess =
      await this.permissionEntityService.canAssignPermissionToUser(
        permissionId,
        targetDepartmentId,
      );
    if (!hasDepartmentAppAccess)
      throw new ForbiddenException(
        'This department doesnt the app which you trying to add permissions for, Please contact Admin',
      );

    return this.updatePermissionForUser(isRemove, permissionId, userId, user);
  }

  private async updatePermissionForUser(
    isRemove: boolean,
    permissionId,
    userId,
    user: Schema.Users,
  ) {
    if (isRemove) {
      await this.permissionEntityService.removePermissionToUser(
        permissionId,
        userId,
      );
      return ControllerResponse.Success;
    }
    await this.permissionEntityService.assignPermissionToUser(
      user,
      permissionId,
      userId,
    );
    return ControllerResponse.Success;
  }
}

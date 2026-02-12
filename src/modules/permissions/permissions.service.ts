import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { UserContext } from 'src/common/bean';
import { withResponseCode } from 'src/common/http';
import {
  CommonEntityService,
  PermissionEntityService,
  UserEntityService,
} from 'src/entities/db';
import { Schema } from 'src/types';
import { PermissionsController } from './permissions.controller';
import { CacheFactory } from 'src/common/cache-factory';

@Injectable()
export class PermissionsService {
  constructor(
    private userEntityService: UserEntityService,
    private permissionEntityService: PermissionEntityService,
    private commonEntityService: CommonEntityService,
    private cacheFactory: CacheFactory,
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

    const [accessAllowed, targetDepartmentIds] =
      await this.commonEntityService.isUserAccessible(userContext, targetUser);

    if (!accessAllowed) {
      throw new ForbiddenException(
        'You dont have access to this department, Please contact Admin',
      );
    }

    const hasDepartmentAppAccess =
      await this.permissionEntityService.canAssignPermissionToUser(
        permissionId,
        targetDepartmentIds,
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
    } else {
      await this.permissionEntityService.assignPermissionToUser(
        user,
        permissionId,
        userId,
      );
    }
    this.cacheFactory.userContext.invalidateByOrg(user.orgId);
    return withResponseCode(HttpStatus.OK).success();
  }
}

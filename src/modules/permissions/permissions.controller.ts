import { Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DecoratorConstants } from 'src/common/constants';
import { Pagination } from 'src/common/decorators/paginated.decorator';
import { AppEntityService, UserEntityService } from 'src/entities/db';
import type { PaginatedArgType } from 'src/types';
import { PermissionsService } from './permissions.service';

@Controller('api/meta-app/permissions')
export class PermissionsController {
  static readonly PermissionAction = {
    Add: 'add',
    Remove: 'remove',
  };
  constructor(
    private permissionService: PermissionsService,
    private userEntityService: UserEntityService,
    private appEntityService: AppEntityService,
  ) {}

  @Get()
  getAllPermissions(@Req() request: Request) {
    return request.beans.UserContext?.value.permissions;
  }

  @Get('apps')
  getApps(@Req() request: Request) {
    return this.appEntityService.getAllJoinApps(request.currentUser);
  }

  @Get('users/:userId')
  getP(
    @Req() request: Request,
    @Pagination()
    req: PaginatedArgType,
    @Param('userId') userId: string,
  ) {
    return this.userEntityService.getUserPermissionsViaContext(
      request.beans.UserContext!,
      userId,
    );
  }

  @Get('users')
  getAllUsers(
    @Req() request: Request,
    @Pagination()
    req: PaginatedArgType,
    @Query('prefix') prefix: string,
  ) {
    return this.userEntityService.getUsersByEmailPrefix(
      request.currentUser,
      prefix,
      req,
      request.beans.UserContext?.value?.departments?.children ?? [],
    );
  }

  @Put('user/:userId/:action/permission/:permissionId')
  updatePermission(
    @Req() request: Request,
    @Param('userId')
    userId: string,
    @Param('permissionId')
    permissionId: string,
    @Param('action') action: string,
  ) {
    return this.permissionService.updatePermission(
      request.currentUser,
      request.beans.UserContext!,
      userId,
      permissionId,
      action,
    );
  }
}

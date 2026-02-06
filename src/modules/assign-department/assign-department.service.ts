import { ForbiddenException, Injectable } from '@nestjs/common';
import { ControllerResponse, UserContext } from 'src/common/bean';
import { CommonEntityService, UserEntityService } from 'src/entities/db';

@Injectable()
export class AssignDepartmentService {
  constructor(
    private commonEntityService: CommonEntityService,
    private userEntityService: UserEntityService,
  ) {}

  private async validateTargetUser(
    userContext: UserContext,
    targetUserId: string,
  ) {
    const targetUser = await this.userEntityService.getById(targetUserId);
    const currentUser = userContext.value.user;
    if (
      !targetUser ||
      targetUser.orgId !== currentUser.orgId ||
      targetUser.isAdmin ||
      currentUser.id === targetUserId
    ) {
      throw new ForbiddenException('Cannot perform action on this user');
    }
    return { targetUser, currentUser };
  }

  async addDepartment(
    userContext: UserContext,
    targetUserId: string,
    departmentId: string,
  ) {
    const { targetUser, currentUser } = await this.validateTargetUser(
      userContext,
      targetUserId,
    );

    if (currentUser.isAdmin) {
      return await this.commonEntityService.addDepartment(
        targetUserId,
        departmentId,
      );
    }

    if (
      !userContext.hasDepartmentAccess(departmentId) &&
      !userContext.value.departments.children.find((d) => d.id === departmentId)
    ) {
      throw new ForbiddenException(
        'You dont have access to this department, Please contact Admin',
      );
    }

    const [accessAllowed] = await this.commonEntityService.isUserAccessible(
      userContext,
      targetUser,
    );
    if (!accessAllowed) {
      throw new ForbiddenException(
        'User cannot be added to this department - Please contact Admin',
      );
    }

    return await this.commonEntityService.addDepartment(
      targetUserId,
      departmentId,
    );
  }

  async removeDepartment(
    userContext: UserContext,
    targetUserId: string,
    departmentId: string,
  ) {
    const { targetUser, currentUser } = await this.validateTargetUser(
      userContext,
      targetUserId,
    );

    if (currentUser.isAdmin) {
      return await this.commonEntityService.removeDepartment(
        targetUserId,
        departmentId,
      );
    }

    if (!userContext.hasDepartmentAccess(departmentId)) {
      throw new ForbiddenException(
        'You dont have access to this department, Please contact Admin',
      );
    }

    const [accessAllowed] = await this.commonEntityService.isUserAccessible(
      userContext,
      targetUser,
    );
    if (!accessAllowed) {
      throw new ForbiddenException(
        'User cannot be removed from this department - Please contact Admin',
      );
    }

    return await this.commonEntityService.removeDepartment(
      targetUserId,
      departmentId,
    );
  }
}

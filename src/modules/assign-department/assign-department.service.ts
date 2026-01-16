import { ForbiddenException, Injectable } from '@nestjs/common';
import { ControllerResponse, UserContext } from 'src/common/bean';
import { CommonEntityService, UserEntityService } from 'src/entities/db';

@Injectable()
export class AssignDepartmentService {
  constructor(
    private commonEntityService: CommonEntityService,
    private userEntityService: UserEntityService,
  ) {}

  async assignDepartment(
    userContext: UserContext,
    targetUserId: string,
    departmentId: string,
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

    const [accessAllowed, targetCurrentDepartmentId] =
      await this.commonEntityService.isUserAccessible(userContext, targetUser);

    if (currentUser.isAdmin) {
      return await this.commonEntityService.updateDepartment(
        targetUserId,
        targetCurrentDepartmentId,
        departmentId,
      );
    }

    //check if provided departmentId is one of the child in currentUser departments
    if (
      !userContext.value.departments.children.find((d) => d.id === departmentId)
    ) {
      throw new ForbiddenException(
        'You dont have access to this department, Please contact Admin',
      );
    }

    //check if targetUser is under currentUser
    if (!accessAllowed) {
      throw new ForbiddenException(
        'User cannot be added to this department - Please contact Admin',
      );
    }
    if (targetCurrentDepartmentId === departmentId) {
      return ControllerResponse.Success;
    }

    return await this.commonEntityService.updateDepartment(
      targetUserId,
      targetCurrentDepartmentId,
      departmentId,
    );
  }
}

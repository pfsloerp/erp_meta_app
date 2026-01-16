import { Controller, Param, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AssignDepartmentService } from './assign-department.service';

@Controller('api/assign-department')
export class AssignDepartmentController {
  constructor(private assignDepartmentService: AssignDepartmentService) {}

  @Put('/user/:userId/department/:departmentId')
  assignDepartment(
    @Req() request: Request,
    @Param('departmentId')
    departmentId: string,
    @Param('userId')
    userId: string,
  ) {
    return this.assignDepartmentService.assignDepartment(
      request.beans.UserContext!,
      userId,
      departmentId,
    );
  }
}

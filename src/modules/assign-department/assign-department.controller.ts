import { Controller, Delete, Param, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AssignDepartmentService } from './assign-department.service';

@Controller('api/assign-department')
export class AssignDepartmentController {
  constructor(private assignDepartmentService: AssignDepartmentService) {}

  @Put('/user/:userId/department/:departmentId')
  addDepartment(
    @Req() request: Request,
    @Param('departmentId')
    departmentId: string,
    @Param('userId')
    userId: string,
  ) {
    return this.assignDepartmentService.addDepartment(
      request.beans.UserContext!,
      userId,
      departmentId,
    );
  }

  @Delete('/user/:userId/department/:departmentId')
  removeDepartment(
    @Req() request: Request,
    @Param('departmentId')
    departmentId: string,
    @Param('userId')
    userId: string,
  ) {
    return this.assignDepartmentService.removeDepartment(
      request.beans.UserContext!,
      userId,
      departmentId,
    );
  }
}

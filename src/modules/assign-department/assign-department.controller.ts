import { Controller, Get, Param, ParseIntPipe, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DecoratorConstants } from 'src/common/constants';
import { AppEntityService } from 'src/entities/db';
import { AssignDepartmentService } from './assign-department.service';

@Controller('api/assign-department')
export class AssignDepartmentController {
  constructor(private assignDepartmentService: AssignDepartmentService) {}

  @Put('/user/:userId/department/:departmentId')
  assignDepartment(
    @Req() request: Request,
    @Param('departmentId', DecoratorConstants.ParsePipeInt)
    departmentId: number,
    @Param('userId', DecoratorConstants.ParsePipeInt)
    userId: number,
  ) {
    return this.assignDepartmentService.assignDepartment(
      request.beans.UserContext!,
      userId,
      departmentId,
    );
  }
}

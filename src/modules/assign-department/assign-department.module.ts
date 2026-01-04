import { Module } from '@nestjs/common';
import { AssignDepartmentController } from './assign-department.controller';
import { AssignDepartmentService } from './assign-department.service';

@Module({
  controllers: [AssignDepartmentController],
  providers: [AssignDepartmentService],
})
export class AssignDepartmentModule {}

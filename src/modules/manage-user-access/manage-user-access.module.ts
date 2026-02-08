import { Module } from '@nestjs/common';
import { ManageUserAccessController } from './manage-user-access.controller';
import { ManageUserAccessService } from './manage-user-access.service';

@Module({
  controllers: [ManageUserAccessController],
  providers: [ManageUserAccessService],
})
export class ManageUserAccessModule {}

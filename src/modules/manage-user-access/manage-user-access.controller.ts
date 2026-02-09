import { Controller, Put } from '@nestjs/common';
import { UUIDParam } from 'src/common/decorators';
import { ManageUserAccessService } from './manage-user-access.service';

@Controller('api/meta-app/manage-user-access')
export class ManageUserAccessController {
  constructor(private manageUserAccessService: ManageUserAccessService) {}

  @Put(':userId/revoke')
  revoke(
    @UUIDParam('userId') userId: string,
  ) {
    return this.manageUserAccessService.revokeAccess(userId);
  }

  @Put(':userId/enable')
  enable(
    @UUIDParam('userId') userId: string,
  ) {
    return this.manageUserAccessService.enableAccess(userId);
  }
}

import { Controller, Param, Put } from '@nestjs/common';
import { ZodRawValidatePipe } from 'src/common';
import { ZodConstants } from 'src/common/constants';
import { ManageUserAccessService } from './manage-user-access.service';

@Controller('api/meta-app/manage-user-access')
export class ManageUserAccessController {
  constructor(private manageUserAccessService: ManageUserAccessService) {}

  @Put(':userId/revoke')
  revoke(
    @Param('userId', ZodRawValidatePipe.inject(ZodConstants.UUID))
    userId: string,
  ) {
    return this.manageUserAccessService.revokeAccess(userId);
  }

  @Put(':userId/enable')
  enable(
    @Param('userId', ZodRawValidatePipe.inject(ZodConstants.UUID))
    userId: string,
  ) {
    return this.manageUserAccessService.enableAccess(userId);
  }
}

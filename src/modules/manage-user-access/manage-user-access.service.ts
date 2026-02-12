import { HttpStatus, Injectable } from '@nestjs/common';
import { withResponseCode } from 'src/common/http';
import { CacheFactory } from 'src/common/cache-factory';
import { UserEntityService } from 'src/entities/db';

@Injectable()
export class ManageUserAccessService {
  constructor(
    private userEntityService: UserEntityService,
    private cacheFactory: CacheFactory,
  ) {}

  async revokeAccess(userId: string) {
    const user = await this.userEntityService.getById(userId);
    if (!user || user.isAdmin) {
      return withResponseCode(HttpStatus.OK).item({ userId });
    }
    await this.userEntityService.setDisabled(userId, true);
    this.cacheFactory.userContext.invalidateByOrg(user.orgId);
    this.cacheFactory.authUser.invalidate(userId);
    return withResponseCode(HttpStatus.OK).item({ userId });
  }

  async enableAccess(userId: string) {
    const user = await this.userEntityService.getById(userId);
    if (!user || user.isAdmin) {
      return withResponseCode(HttpStatus.OK).item({ userId });
    }
    await this.userEntityService.setDisabled(userId, false);
    this.cacheFactory.userContext.invalidateByOrg(user.orgId);
    this.cacheFactory.authUser.invalidate(userId);
    return withResponseCode(HttpStatus.OK).item({ userId });
  }
}

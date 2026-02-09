import { Body, Controller, Delete, Get, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SchemaPipe } from 'src/common';
import { UUIDParam } from 'src/common/decorators';
import { Pagination } from 'src/common/decorators/paginated.decorator';
import type { PaginatedArgType } from 'src/types';
import z from 'zod';
import { MetaAppFormsService } from './forms.service';

@Controller('api/meta-app/forms')
export class MetaAppFormsController {
  constructor(private formsService: MetaAppFormsService) {}

  static readonly createSchema = z.object({
    form: z.object({
      name: z.string().nonempty(),
      description: z.string().optional(),
      content: z.record(z.string(), z.unknown()),
    }),
    additionalInfo: z.record(z.string(), z.unknown()).optional(),
  });

  static readonly updateSchema = z.object({
    form: z.object({
      name: z.string().nonempty().optional(),
      description: z.string().optional(),
      content: z.record(z.string(), z.unknown()).optional(),
    }),
    additionalInfo: z.record(z.string(), z.unknown()).optional(),
  });

  @Get()
  getAll(
    @Pagination() paginatedArg: PaginatedArgType,
    @Req() req: Request,
  ) {
    return this.formsService.getAll(
      paginatedArg,
      req.beans.UserContext!.value.user.orgId,
    );
  }

  @Post()
  create(
    @Body(SchemaPipe.inject(MetaAppFormsController.createSchema))
    body: z.infer<typeof MetaAppFormsController.createSchema>,
    @Req() req: Request,
  ) {
    return this.formsService.create(
      body,
      req.beans.UserContext!.value.user.orgId,
    );
  }

  @Put(':id')
  update(
    @UUIDParam('id') id: string,
    @Body(SchemaPipe.inject(MetaAppFormsController.updateSchema))
    body: z.infer<typeof MetaAppFormsController.updateSchema>,
    @Req() req: Request,
  ) {
    return this.formsService.update(
      id,
      body,
      req.beans.UserContext!.value.user.orgId,
    );
  }

  @Delete(':id')
  remove(
    @UUIDParam('id') id: string,
    @Req() req: Request,
  ) {
    return this.formsService.delete(
      id,
      req.beans.UserContext!.value.user.orgId,
    );
  }
}

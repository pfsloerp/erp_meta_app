import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
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
  getAll(@Pagination() paginatedArg: PaginatedArgType) {
    return this.formsService.getAll(paginatedArg);
  }

  @Post()
  create(
    @Body(SchemaPipe.inject(MetaAppFormsController.createSchema))
    body: z.infer<typeof MetaAppFormsController.createSchema>,
  ) {
    return this.formsService.create(body);
  }

  @Put(':id')
  update(
    @UUIDParam('id') id: string,
    @Body(SchemaPipe.inject(MetaAppFormsController.updateSchema))
    body: z.infer<typeof MetaAppFormsController.updateSchema>,
  ) {
    return this.formsService.update(id, body);
  }

  @Delete(':id')
  remove(@UUIDParam('id') id: string) {
    return this.formsService.delete(id);
  }
}

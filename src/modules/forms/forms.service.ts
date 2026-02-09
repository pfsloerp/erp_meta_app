import { HttpStatus, Injectable } from '@nestjs/common';
import { withResponseCode } from 'src/common/http';
import { FormsEntityService } from 'src/entities/db';
import { PaginatedArgType } from 'src/types';

@Injectable()
export class MetaAppFormsService {
  constructor(private formsEntityService: FormsEntityService) {}

  async getAll(paginatedArg: PaginatedArgType, orgId: string) {
    const { items, total } = await this.formsEntityService.getAllForms(
      paginatedArg,
      { orgId },
    );
    return withResponseCode(HttpStatus.OK).items(items, { total });
  }

  async create(
    body: {
      form: {
        name: string;
        description?: string;
        content: Record<string, unknown>;
      };
      additionalInfo?: Record<string, unknown>;
    },
    orgId: string,
  ) {
    const result = await this.formsEntityService.createForm(
      {
        name: body.form.name,
        description: body.form.description,
        content: body.form.content,
        additionalInfo: body.additionalInfo,
      },
      { throw: true, orgId },
    );
    return withResponseCode(HttpStatus.CREATED).item(result);
  }

  async update(
    id: string,
    body: {
      form: {
        name?: string;
        description?: string;
        content?: Record<string, unknown>;
      };
      additionalInfo?: Record<string, unknown>;
    },
    orgId: string,
  ) {
    const payload: Record<string, unknown> = {};
    if (body.form.name !== undefined) payload.name = body.form.name;
    if (body.form.description !== undefined)
      payload.description = body.form.description;
    if (body.form.content !== undefined) payload.content = body.form.content;
    if (body.additionalInfo !== undefined)
      payload.additionalInfo = body.additionalInfo;

    const result = await this.formsEntityService.updateForm(id, payload, {
      throw: true,
      orgId,
    });
    return withResponseCode(HttpStatus.OK).item(result);
  }

  async delete(id: string, orgId: string) {
    await this.formsEntityService.deleteForm(id, { throw: true, orgId });
    return withResponseCode(HttpStatus.OK).success();
  }
}

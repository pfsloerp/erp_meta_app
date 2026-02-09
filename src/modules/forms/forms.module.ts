import { Module } from '@nestjs/common';
import { MetaAppFormsController } from './forms.controller';
import { MetaAppFormsService } from './forms.service';

@Module({
  controllers: [MetaAppFormsController],
  providers: [MetaAppFormsService],
})
export class MetaAppFormsModule {}

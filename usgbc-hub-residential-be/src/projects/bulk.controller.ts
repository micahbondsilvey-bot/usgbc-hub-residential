import {
  Controller,
  Post,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { BulkRegistrationOrchestrator } from './bulk-registration.orchestrator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB (BR-B4)
const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

@ApiTags('projects')
@ApiBearerAuth()
@Controller({ path: 'projects', version: '1' })
export class BulkController {
  constructor(private readonly bulk: BulkRegistrationOrchestrator) {}

  @Post('bulk')
  @Throttle(5, 60)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: { buffer: Buffer; originalname: string; size: number; mimetype: string },
  ) {
    if (!file) throw new UnsupportedMediaTypeException('A spreadsheet file is required');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException('Only .xlsx or .xls files are accepted');
    }
    return this.bulk.bulkRegister(file, user);
  }
}

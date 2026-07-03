import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SubmittalsOrchestrator, UploadFile } from './submittals.orchestrator';
import { ProjectRoles } from '../auth/decorators/project-roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

const ALL_ROLES = [ProjectRole.PROJECT_TEAM, ProjectRole.GREEN_RATER, ProjectRole.REVIEWER];
const MAX_BYTES = 26_214_400;

@ApiTags('workbook')
@ApiBearerAuth()
@Controller({ path: 'projects/:projectId/workbook', version: '1' })
@ProjectRoles(...ALL_ROLES)
export class SubmittalsController {
  constructor(private readonly submittals: SubmittalsOrchestrator) {}

  @Post('credits/:creditId/slots/:slotKey/files')
  @Throttle(20, 60)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('creditId') creditId: string,
    @Param('slotKey') slotKey: string,
    @UploadedFile() file: UploadFile,
  ) {
    return this.submittals.upload(projectId, creditId, slotKey, file, user);
  }

  @Get('files/:submittalId/url')
  signedUrl(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('submittalId') submittalId: string,
  ) {
    return this.submittals.createSignedUrl(projectId, submittalId, user);
  }

  @Delete('files/:submittalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('submittalId') submittalId: string,
  ) {
    return this.submittals.delete(projectId, submittalId, user);
  }
}

/** Public token-authenticated file stream (BL-6). */
@ApiTags('submittals')
@Controller({ path: 'submittals', version: '1' })
export class SubmittalFilesController {
  constructor(private readonly submittals: SubmittalsOrchestrator) {}

  @Public()
  @Get('files/:token')
  async stream(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const result = await this.submittals.streamByToken(token);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.originalFileName.replace(/"/g, '')}"`,
    );
    res.send(result.buffer);
  }
}

import { BadRequestException, Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkbookService } from './workbook.service';
import { NotesService } from './notes.service';
import { NoteColumn } from './enums';
import { ProjectRoles } from '../auth/decorators/project-roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { WriteFieldEntryDto, WriteNoteDto } from './dto/workbook.dto';

const ALL_ROLES = [ProjectRole.PROJECT_TEAM, ProjectRole.GREEN_RATER, ProjectRole.REVIEWER];

@ApiTags('workbook')
@ApiBearerAuth()
@Controller({ path: 'projects/:projectId/workbook', version: '1' })
@ProjectRoles(...ALL_ROLES)
export class WorkbookController {
  constructor(
    private readonly workbook: WorkbookService,
    private readonly notes: NotesService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.workbook.getWorkbook(projectId, user);
  }

  @Get('flags')
  flags(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.workbook.getFlags(projectId, user);
  }

  @Get('credits/:creditId')
  credit(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('creditId') creditId: string,
  ) {
    return this.workbook.getCreditWorkbook(projectId, creditId, user);
  }

  @Put('credits/:creditId/fields/:fieldDefinitionId')
  writeField(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('creditId') creditId: string,
    @Param('fieldDefinitionId') fieldDefinitionId: string,
    @Body() dto: WriteFieldEntryDto,
  ) {
    return this.workbook.writeFieldEntry(projectId, creditId, fieldDefinitionId, dto, user);
  }

  @Put('credits/:creditId/notes/:column')
  writeNote(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('creditId') creditId: string,
    @Param('column') column: string,
    @Body() dto: WriteNoteDto,
  ) {
    const col = this.parseColumn(column);
    return this.notes.saveNote(projectId, creditId, col, dto.body ?? null, user);
  }

  private parseColumn(value: string): NoteColumn {
    const upper = (value ?? '').toUpperCase();
    if (upper in NoteColumn) return NoteColumn[upper as keyof typeof NoteColumn];
    throw new BadRequestException('Invalid note column');
  }
}

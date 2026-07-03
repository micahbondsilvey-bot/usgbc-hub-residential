import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { RegistrationOrchestrator } from './registration.orchestrator';
import { AgreementService } from './agreement.service';
import { InvoiceService } from './invoice.service';
import { ProjectRoles } from '../auth/decorators/project-roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectRole } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto, WithdrawProjectDto } from './dto/update-project.dto';

const ALL_ROLES = [ProjectRole.PROJECT_TEAM, ProjectRole.GREEN_RATER, ProjectRole.REVIEWER];

@ApiTags('projects')
@ApiBearerAuth()
@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly registration: RegistrationOrchestrator,
    private readonly agreements: AgreementService,
    private readonly invoices: InvoiceService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('mine') _mine?: string) {
    return this.projects.listAccessible(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    if (dto.mode === 'register') {
      return this.registration.register(dto, user);
    }
    return this.registration.createDraft(dto, user);
  }

  @Get(':projectId')
  @ProjectRoles(...ALL_ROLES)
  detail(@Param('projectId') projectId: string) {
    return this.projects.findById(projectId);
  }

  @Patch(':projectId')
  @ProjectRoles(...ALL_ROLES)
  patch(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.patch(projectId, dto, user);
  }

  @Post(':projectId/agreement')
  @ProjectRoles(...ALL_ROLES)
  sign(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.agreements.sign(projectId, user);
  }

  @Get(':projectId/agreement')
  @ProjectRoles(...ALL_ROLES)
  getAgreement(@Param('projectId') projectId: string) {
    return this.agreements.getLatest(projectId);
  }

  @Get(':projectId/invoice')
  @ProjectRoles(...ALL_ROLES)
  getInvoice(@Param('projectId') projectId: string) {
    return this.invoices.findForProject(projectId);
  }

  @Post(':projectId/withdraw')
  @ProjectRoles(ProjectRole.PROJECT_TEAM)
  withdraw(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: WithdrawProjectDto,
  ) {
    return this.projects.withdraw(projectId, dto.note, user);
  }
}

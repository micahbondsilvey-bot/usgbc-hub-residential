import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/project.entity';
import { ProjectStatus } from '../projects/enums';
import { GlobalRole, ProjectRole } from '../auth/enums/role.enum';
import { MembershipService } from '../membership/membership.service';

export interface LockActor {
  userId: string;
  globalRole: GlobalRole;
}

/**
 * Real state-lock (Unit 5, BR-Z1/BR-RW3). Blocks Project Team / Green Rater writes while a
 * project is UNDER_REVIEW. System writes (no actor) and Admin always pass. Reviewers are
 * permitted because they must record award decisions during the review.
 */
@Injectable()
export class StateLockService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly membership: MembershipService,
  ) {}

  async assertWritable(projectId: string, actor?: LockActor): Promise<void> {
    if (!actor) return; // system writes pass
    if (actor.globalRole === GlobalRole.ADMIN) return;
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) return; // creation paths pre-existence; caller 404s elsewhere
    if (project.status !== ProjectStatus.UNDER_REVIEW) return;

    const role = await this.membership.resolveActiveRole(actor.userId, projectId);
    if (role === ProjectRole.REVIEWER) return; // reviewers write during review
    throw new ConflictException(
      'Project is under review and cannot be edited until the review is returned.',
    );
  }
}

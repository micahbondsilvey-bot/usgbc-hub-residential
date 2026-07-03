import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Creates the two display-id sequences (BL-7). TypeORM synchronize does not
 * manage sequences, so we ensure them idempotently on boot.
 */
@Injectable()
export class RegistrationDdlBootstrapper implements OnModuleInit {
  private readonly logger = new Logger(RegistrationDdlBootstrapper.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query(
      'CREATE SEQUENCE IF NOT EXISTS projects_display_seq START 100001 NO CYCLE',
    );
    await this.dataSource.query(
      'CREATE SEQUENCE IF NOT EXISTS invoices_display_seq START 100001 NO CYCLE',
    );
    await this.dataSource.query(
      'CREATE SEQUENCE IF NOT EXISTS reviews_display_seq START 100001 NO CYCLE',
    );

    // Unit 6 portfolio hierarchy constraints (idempotent).
    await this.dataSource.query(`
      DO $$ BEGIN
        ALTER TABLE projects
          ADD CONSTRAINT project_parent_anchor_fk
          FOREIGN KEY ("parentAnchorId") REFERENCES projects(id) ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await this.dataSource.query(`
      DO $$ BEGIN
        ALTER TABLE projects
          ADD CONSTRAINT project_no_self_parent_chk CHECK ("parentAnchorId" <> id);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await this.dataSource.query(`
      DO $$ BEGIN
        ALTER TABLE projects
          ADD CONSTRAINT project_anchor_no_parent_chk
          CHECK (NOT ("isPortfolioAnchor" = true AND "parentAnchorId" IS NOT NULL));
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await this.dataSource.query(
      'CREATE INDEX IF NOT EXISTS project_parent_anchor_idx ON projects ("parentAnchorId") WHERE "parentAnchorId" IS NOT NULL',
    );

    this.logger.log('Registration display-id sequences ensured.');
  }
}

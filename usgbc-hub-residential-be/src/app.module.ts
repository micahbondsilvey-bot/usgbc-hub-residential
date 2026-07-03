import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import configuration from './config/configuration';
import { RequestContextModule } from './common/request-context/request-context.module';
import { RequestContextMiddleware } from './common/request-context/request-context.middleware';
import { HooksModule } from './common/hooks/hooks.module';
import { TokensModule } from './common/tokens/tokens.module';
import { AppThrottlerModule } from './common/throttler/throttler.module';
import { NotificationsModule } from './common/notifications-stub/notifications.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MembershipModule } from './membership/membership.module';
import { CatalogModule } from './catalog/catalog.module';
import { ScorecardModule } from './scorecard/scorecard.module';
import { FeesModule } from './fees/fees.module';
import { ProjectsModule } from './projects/projects.module';
import { WorkbookModule } from './workbook/workbook.module';
import { ReviewModule } from './review/review.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { NotificationFrameworkModule } from './notifications/notification-framework.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ProjectRolesGuard } from './auth/guards/project-roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('db.host'),
        port: config.get<number>('db.port'),
        username: config.get<string>('db.user'),
        password: config.get<string>('db.password'),
        database: config.get<string>('db.name'),
        autoLoadEntities: true,
        synchronize: config.get<boolean>('db.synchronize', true),
        extra: {
          max: config.get<number>('db.poolSize', 10),
          idleTimeoutMillis: config.get<number>('db.idleTimeoutMs', 30000),
        },
      }),
    }),
    RequestContextModule,
    TokensModule,
    NotificationsModule,
    HooksModule,
    AppThrottlerModule,
    AuditModule,
    UsersModule,
    AuthModule,
    MembershipModule,
    CatalogModule,
    ScorecardModule,
    FeesModule,
    ProjectsModule,
    WorkbookModule,
    ReviewModule,
    PortfolioModule,
    NotificationFrameworkModule,
    DashboardsModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ProjectRolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

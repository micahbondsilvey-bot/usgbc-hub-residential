import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatingSystem } from './rating-system.entity';
import { CreditCategory } from './credit-category.entity';
import { Credit } from './credit.entity';
import { CreditPointValue } from './credit-point-value.entity';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { CatalogSeeder } from './catalog.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([RatingSystem, CreditCategory, Credit, CreditPointValue]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogSeeder],
  exports: [CatalogService],
})
export class CatalogModule {}

import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { RatingSystemDto, RatingSystemSummaryDto } from './dto/rating-system.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('rating-systems')
  @ApiOkResponse({ type: [RatingSystemSummaryDto] })
  list(): Promise<RatingSystemSummaryDto[]> {
    return this.catalog.listRatingSystems();
  }

  @Get('rating-systems/:idOrSlug')
  @ApiOkResponse({ type: RatingSystemDto })
  get(@Param('idOrSlug') idOrSlug: string): Promise<RatingSystemDto> {
    return this.catalog.getRatingSystem(idOrSlug);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { multerOptions } from '../common/multer.config';
import { UserDocument } from '../users/schemas/user.schema';
import { ListingQuery, MarketplaceService } from './marketplace.service';
import { CreateListingDto, UpdateStatusDto } from './dto/create-listing.dto';

@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  // GET /api/marketplace?q=&category=&minPrice=&maxPrice=&seller=&limit=
  @Get()
  list(@Query() query: ListingQuery) {
    return this.marketplaceService.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketplaceService.findOne(id);
  }

  // POST /api/marketplace (multipart: fields + up to 5 `images`)
  @Post()
  @UseInterceptors(FilesInterceptor('images', 5, multerOptions))
  create(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateListingDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.marketplaceService.create((user as any)._id.toString(), dto, files);
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @CurrentUser() user: UserDocument, @Body() dto: UpdateStatusDto) {
    return this.marketplaceService.setStatus(id, user, dto.status);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.marketplaceService.remove(id, user);
  }
}

import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { PagesService } from './pages.service';

@Controller('pages')
@UseGuards(JwtAuthGuard)
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  // GET /api/pages?mine=1&q=text - browse/search pages, or ones you follow.
  @Get()
  list(@CurrentUser() user: UserDocument, @Query('mine') mine?: string, @Query('q') q?: string) {
    return this.pagesService.list((user as any)._id.toString(), { mine: mine === '1' || mine === 'true', q });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.pagesService.findOne(id, (user as any)._id.toString());
  }

  // Toggles follow/unfollow.
  @Post(':id/follow')
  follow(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.pagesService.toggleFollow(id, (user as any)._id.toString());
  }
}

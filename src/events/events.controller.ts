import { Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { multerOptions } from '../common/multer.config';
import { UserDocument } from '../users/schemas/user.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsService } from './events.service';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // GET /api/events?mine=1 - upcoming events, soonest first.
  @Get()
  list(@CurrentUser() user: UserDocument, @Query('mine') mine?: string) {
    return this.eventsService.list(user, { mine: mine === '1' || mine === 'true' });
  }

  // POST /api/events (multipart: title, startsAt, location?, description?, coverImage?)
  @Post()
  @UseInterceptors(FileInterceptor('coverImage', multerOptions))
  create(@CurrentUser() user: UserDocument, @Body() dto: CreateEventDto, @UploadedFile() file?: Express.Multer.File) {
    return this.eventsService.create(user, dto, file ? `/uploads/${file.filename}` : '');
  }

  // POST /api/events/:id/going - toggles the caller's RSVP.
  @Post(':id/going')
  going(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.eventsService.toggleGoing(id, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.eventsService.remove(id, user);
  }
}

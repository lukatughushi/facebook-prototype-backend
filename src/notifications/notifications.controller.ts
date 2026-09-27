import { Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: UserDocument) {
    return this.notificationsService.list((user as any)._id.toString());
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: UserDocument) {
    return this.notificationsService.unreadCount((user as any)._id.toString());
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: UserDocument) {
    return this.notificationsService.markAllRead((user as any)._id.toString());
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.notificationsService.markRead(id, (user as any)._id.toString());
  }

  // DELETE /api/notifications - clears the caller's notifications.
  @Delete()
  clearAll(@CurrentUser() user: UserDocument) {
    return this.notificationsService.clearAll((user as any)._id.toString());
  }

  // DELETE /api/notifications/:id - returns the new unread count.
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.notificationsService.remove(id, (user as any)._id.toString());
  }
}

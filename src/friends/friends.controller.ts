import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FriendsService } from './friends.service';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  listFriends(@CurrentUser() user: UserDocument) {
    return this.friendsService.listFriends((user as any)._id.toString());
  }

  @Get('requests')
  listRequests(@CurrentUser() user: UserDocument) {
    return this.friendsService.listRequests((user as any)._id.toString());
  }

  @Get('status/:id')
  getRelationship(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.friendsService.getRelationship((user as any)._id.toString(), id);
  }

  @Post('request/:id')
  sendRequest(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.friendsService.sendRequest((user as any)._id.toString(), id);
  }

  @Post('cancel/:id')
  cancelRequest(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.friendsService.cancelRequest((user as any)._id.toString(), id);
  }

  @Post('accept/:id')
  acceptRequest(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.friendsService.acceptRequest((user as any)._id.toString(), id);
  }

  @Post('reject/:id')
  rejectRequest(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.friendsService.rejectRequest((user as any)._id.toString(), id);
  }

  @Delete(':id')
  removeFriend(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.friendsService.removeFriend((user as any)._id.toString(), id);
  }
}

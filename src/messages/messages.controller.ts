import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // GET /api/messages/conversations - chat list for the header Messages panel.
  // Declared before ':userId' so "conversations" isn't treated as an id.
  @Get('conversations')
  listConversations(@CurrentUser() user: UserDocument) {
    return this.messagesService.listConversations((user as any)._id.toString());
  }

  // GET /api/messages/:userId - full conversation history with a friend.
  @Get(':userId')
  getConversation(@Param('userId') userId: string, @CurrentUser() user: UserDocument) {
    return this.messagesService.getConversation((user as any)._id.toString(), userId);
  }

  // PATCH /api/messages/:userId/read - mark a conversation read; called by
  // the chat window whenever it is open and expanded.
  @Patch(':userId/read')
  markRead(@Param('userId') userId: string, @CurrentUser() user: UserDocument) {
    return this.messagesService.markRead((user as any)._id.toString(), userId);
  }

  // POST /api/messages/:userId - send a message, broadcast live via WebSocket.
  @Post(':userId')
  sendMessage(
    @Param('userId') userId: string,
    @CurrentUser() user: UserDocument,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage((user as any)._id.toString(), userId, dto);
  }
}

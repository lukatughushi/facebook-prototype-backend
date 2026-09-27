import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { CreateCommentDto } from '../posts/dto/create-comment.dto';
import { ReactDto } from '../posts/dto/react.dto';
import { ShareDto } from '../posts/dto/share.dto';
import { PostsService } from '../posts/posts.service';
import { ReelsService } from './reels.service';

const uid = (user: UserDocument) => (user as any)._id.toString();

@Controller('reels')
@UseGuards(JwtAuthGuard)
export class ReelsController {
  constructor(
    private readonly reelsService: ReelsService,
    private readonly postsService: PostsService,
  ) {}

  // GET /api/reels?before=<iso>&limit=<n>&author=<userId>
  @Get()
  list(
    @CurrentUser() user: UserDocument,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
    @Query('author') author?: string,
  ) {
    return this.reelsService.list(uid(user), { before, limit: Number(limit) || undefined, author });
  }

  // POST/DELETE /api/reels/muted-authors/:authorId - mute/unmute in Watch.
  // Declared before ':id' routes so "muted-authors" isn't taken for a reel id.
  @Post('muted-authors/:authorId')
  muteAuthor(@Param('authorId') authorId: string, @CurrentUser() user: UserDocument) {
    return this.reelsService.muteAuthor(authorId, uid(user));
  }

  @Delete('muted-authors/:authorId')
  unmuteAuthor(@Param('authorId') authorId: string, @CurrentUser() user: UserDocument) {
    return this.reelsService.unmuteAuthor(authorId, uid(user));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.reelsService.findOne(id, uid(user));
  }

  // POST /api/reels/:id/react { type } - set/switch/remove a reaction.
  @Post(':id/react')
  react(@Param('id') id: string, @CurrentUser() user: UserDocument, @Body() dto: ReactDto) {
    return this.reelsService.react(id, uid(user), dto.type);
  }

  // Kept for older clients: toggles a "like".
  @Post(':id/like')
  like(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.reelsService.react(id, uid(user), 'like');
  }

  // Shares the reel to the caller's timeline as a new post.
  @Post(':id/share')
  share(@Param('id') id: string, @CurrentUser() user: UserDocument, @Body() dto: ShareDto) {
    return this.postsService.shareReel(id, user, dto);
  }

  @Post(':id/comment')
  comment(@Param('id') id: string, @CurrentUser() user: UserDocument, @Body() dto: CreateCommentDto) {
    return this.reelsService.addComment(id, uid(user), dto.content);
  }

  @Post(':id/comments/:commentId/reply')
  reply(@Param('id') id: string, @Param('commentId') commentId: string, @CurrentUser() user: UserDocument, @Body() dto: CreateCommentDto) {
    return this.reelsService.addReply(id, commentId, uid(user), dto.content);
  }

  // Works for comments and replies.
  @Post(':id/comments/:commentId/react')
  reactToComment(@Param('id') id: string, @Param('commentId') commentId: string, @CurrentUser() user: UserDocument, @Body() dto: ReactDto) {
    return this.reelsService.reactToComment(id, commentId, uid(user), dto.type);
  }

  // Author only; works for comments and replies.
  @Patch(':id/comments/:commentId')
  editComment(@Param('id') id: string, @Param('commentId') commentId: string, @CurrentUser() user: UserDocument, @Body() dto: CreateCommentDto) {
    return this.reelsService.editComment(id, commentId, uid(user), dto.content);
  }

  // POST /api/reels/:id/not-interested - hide this reel from your Watch feed.
  @Post(':id/not-interested')
  notInterested(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.reelsService.hide(id, uid(user));
  }

  @Delete(':id/not-interested')
  undoNotInterested(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.reelsService.unhide(id, uid(user));
  }

  @Post(':id/view')
  view(@Param('id') id: string) {
    return this.reelsService.view(id);
  }
}

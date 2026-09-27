import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post as HttpPost,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { multerOptions } from '../common/multer.config';
import { FeedQuery, PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { ReactDto } from './dto/react.dto';
import { ShareDto } from './dto/share.dto';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // GET /api/posts?author=|group=|page=<id>|saved=1|memories=1&before=<iso>&limit=<n>
  @Get()
  getFeed(@CurrentUser() user: UserDocument, @Query() query: FeedQuery) {
    return this.postsService.getFeed(user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.postsService.findOne(id, user);
  }

  // GET /api/posts/:id/reactions - who reacted, with each person's reaction.
  @Get(':id/reactions')
  reactions(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.postsService.reactions(id, user);
  }

  // POST /api/posts/:id/save - toggles the post in the caller's saved list.
  @HttpPost(':id/save')
  toggleSave(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.postsService.toggleSave(id, user);
  }

  @HttpPost()
  @UseInterceptors(FileInterceptor('image', multerOptions))
  create(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.postsService.create((user as any)._id.toString(), dto, file ? `/uploads/${file.filename}` : undefined);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: UserDocument, @Body() dto: UpdatePostDto) {
    return this.postsService.update(id, user, dto);
  }

  @HttpPost(':id/like')
  toggleLike(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.postsService.toggleLike(id, (user as any)._id.toString());
  }

  // POST /api/posts/:id/react { type: like|love|care|haha|wow|sad|angry } -
  // set, switch or (same type / no type) remove the caller's reaction.
  @HttpPost(':id/react')
  react(@Param('id') id: string, @CurrentUser() user: UserDocument, @Body() dto: ReactDto) {
    return this.postsService.react(id, (user as any)._id.toString(), dto.type);
  }

  // POST /api/posts/:id/share { content?, audience? } - creates a post on
  // the caller's timeline that shares this one.
  @HttpPost(':id/share')
  share(@Param('id') id: string, @CurrentUser() user: UserDocument, @Body() dto: ShareDto) {
    return this.postsService.share(id, user, dto);
  }

  @HttpPost(':id/comments/:commentId/reply')
  addReply(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateCommentDto,
  ) {
    return this.postsService.addReply(id, commentId, (user as any)._id.toString(), dto);
  }

  // Works for both comments and replies.
  @HttpPost(':id/comments/:commentId/react')
  reactToComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: UserDocument,
    @Body() dto: ReactDto,
  ) {
    return this.postsService.reactToComment(id, commentId, (user as any)._id.toString(), dto.type);
  }

  // PATCH /api/posts/:id/comments/:commentId { content } - author only;
  // works for comments and replies.
  @Patch(':id/comments/:commentId')
  editComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateCommentDto,
  ) {
    return this.postsService.editComment(id, commentId, (user as any)._id.toString(), dto);
  }

  // Kept for older clients: toggles a "like" on a comment/reply.
  @HttpPost(':id/comments/:commentId/like')
  likeComment(@Param('id') id: string, @Param('commentId') commentId: string, @CurrentUser() user: UserDocument) {
    return this.postsService.reactToComment(id, commentId, (user as any)._id.toString(), 'like');
  }

  @HttpPost(':id/comment')
  addComment(@Param('id') id: string, @CurrentUser() user: UserDocument, @Body() dto: CreateCommentDto) {
    return this.postsService.addComment(id, (user as any)._id.toString(), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.postsService.remove(id, user);
  }
}

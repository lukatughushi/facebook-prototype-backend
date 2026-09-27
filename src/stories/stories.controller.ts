import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { multerOptions } from '../common/multer.config';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  // Active stories, minus those from people the caller has muted.
  @Get()
  findActive(@CurrentUser() user: UserDocument) {
    return this.storiesService.findActive(user);
  }

  // POST /api/stories/mute/:userId - hide that person's stories.
  @Post('mute/:userId')
  mute(@Param('userId') userId: string, @CurrentUser() user: UserDocument) {
    return this.storiesService.setMuted(user, userId, true);
  }

  // DELETE /api/stories/mute/:userId - show them again.
  @Delete('mute/:userId')
  unmute(@Param('userId') userId: string, @CurrentUser() user: UserDocument) {
    return this.storiesService.setMuted(user, userId, false);
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', multerOptions))
  create(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateStoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.storiesService.create(
      (user as any)._id.toString(),
      dto,
      file ? `/uploads/${file.filename}` : undefined,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.storiesService.remove(id, user);
  }
}

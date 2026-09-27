import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerOptions } from '../common/multer.config';
import { CreateGroupDto } from './dto/create-group.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { GroupsService } from './groups.service';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  // GET /api/groups?mine=1&q=text - browse/search groups, or just your own.
  @Get()
  list(@CurrentUser() user: UserDocument, @Query('mine') mine?: string, @Query('q') q?: string) {
    return this.groupsService.list((user as any)._id.toString(), { mine: mine === '1' || mine === 'true', q });
  }

  // POST /api/groups (multipart: name, description?, category?, privacy?,
  // coverImage?) - the creator becomes the group's first member and admin.
  @Post()
  @UseInterceptors(FileInterceptor('coverImage', multerOptions))
  create(@CurrentUser() user: UserDocument, @Body() dto: CreateGroupDto, @UploadedFile() file?: Express.Multer.File) {
    return this.groupsService.create((user as any)._id.toString(), dto, file ? `/uploads/${file.filename}` : '');
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.groupsService.findOne(id, (user as any)._id.toString());
  }

  @Post(':id/join')
  join(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.groupsService.join(id, (user as any)._id.toString());
  }

  @Post(':id/leave')
  leave(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.groupsService.leave(id, (user as any)._id.toString());
  }
}

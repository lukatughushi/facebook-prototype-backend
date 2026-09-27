import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { multerOptions } from '../common/multer.config';
import { User, UserDocument } from './schemas/user.schema';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CoverPositionDto } from './dto/cover-position.dto';
import { PostsService } from '../posts/posts.service';
import { applyNameChange } from './name-change';

// Public profile - deliberately excludes email (and the caller's saved posts).
const PROFILE_FIELDS =
  'name avatar bio coverImage coverPosition avatarPostId coverPostId work education city hometown role createdAt friends';

const clampPosition = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;

// Our upload names are "<field>-<ms timestamp>-<random>.<ext>"; seeded photos
// are external URLs, for which there is no date.
const uploadedAt = (image: string) => {
  const ms = Number(image.match(/^\/uploads\/[a-zA-Z]+-(\d{13})-/)?.[1]);
  return ms ? new Date(ms) : undefined;
};

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly postsService: PostsService,
  ) {}

  // GET /api/users?q=<text> - lightweight directory (name/avatar) used by the
  // header people search. Excludes the caller and inactive accounts.
  @Get()
  async findAll(@CurrentUser() currentUser: UserDocument, @Query('q') q?: string) {
    const filter: Record<string, unknown> = { _id: { $ne: (currentUser as any)._id }, isActive: true };
    if (q?.trim()) filter.name = { $regex: escapeRegex(q.trim()), $options: 'i' };

    const users = await this.userModel.find(filter).select('name avatar').sort({ name: 1 }).limit(30);
    return { users };
  }

  // PATCH /api/users/profile { firstName?, lastName?, email?, currentPassword? }
  // Settings > Personal information. Name changes have a 7-day cooldown;
  // changing the email needs the current password.
  @Patch('profile')
  async updateAccount(@CurrentUser() currentUser: UserDocument, @Body() dto: UpdateAccountDto) {
    const user = await this.userModel.findById((currentUser as any)._id).select('+password');
    if (!user) throw new NotFoundException('User not found');

    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const [first, ...rest] = user.name.split(' ');
      const firstName = (dto.firstName ?? first).trim();
      if (!firstName) throw new BadRequestException('First name is required');
      applyNameChange(user, `${firstName} ${(dto.lastName ?? rest.join(' ')).trim()}`);
    }

    const email = dto.email?.toLowerCase().trim();
    if (email && email !== user.email) {
      if (!dto.currentPassword || !(await bcrypt.compare(dto.currentPassword, user.password))) {
        throw new BadRequestException('Enter your current password to change your email');
      }
      if (await this.userModel.exists({ email, _id: { $ne: user._id } })) {
        throw new ConflictException('An account with this email already exists');
      }
      user.email = email;
    }

    await user.save();
    return { user };
  }

  // POST /api/users/avatar - upload/replace the current user's profile
  // picture (the client sends the already-cropped image). Also publishes an
  // "updated their profile picture" post, returned as `post`.
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar', multerOptions))
  async updateAvatar(@CurrentUser() currentUser: UserDocument, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Avatar image is required');
    }

    const userId = (currentUser as any)._id.toString();
    const image = `/uploads/${file.filename}`;
    const post = await this.postsService.createProfilePhotoPost(userId, image, 'avatar');
    const user = await this.userModel.findByIdAndUpdate(userId, { avatar: image, avatarPostId: post?._id }, { new: true });
    return { user, post };
  }

  // POST /api/users/cover (multipart: cover, position?) - upload/replace the
  // cover photo and publish an "updated their cover photo" post.
  @Post('cover')
  @UseInterceptors(FileInterceptor('cover', multerOptions))
  async updateCover(
    @CurrentUser() currentUser: UserDocument,
    // Read raw and clamped (not validated): a 400 here would come after
    // multer has already stored the file, leaving it orphaned.
    @Body('position') rawPosition?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Cover image is required');
    }

    const userId = (currentUser as any)._id.toString();
    const image = `/uploads/${file.filename}`;
    const post = await this.postsService.createProfilePhotoPost(userId, image, 'cover');
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { coverImage: image, coverPosition: clampPosition(Number.isFinite(Number(rawPosition)) ? Number(rawPosition) : 50), coverPostId: post?._id },
      { new: true },
    );
    return { user, post };
  }

  // GET /api/users/:id/photo-post?kind=avatar|cover - the post behind this
  // person's current profile picture / cover photo, used by the photo viewer
  // for reactions and comments. Photos set before photo posts existed get
  // one created on first view (hidden from feeds, dated from the upload).
  @Get(':id/photo-post')
  async photoPost(@Param('id') id: string, @Query('kind') kind: string) {
    if (kind !== 'avatar' && kind !== 'cover') throw new BadRequestException('kind must be avatar or cover');
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('User not found');
    const field = kind === 'avatar' ? 'avatarPostId' : 'coverPostId';
    const user = await this.userModel.findById(id).select(`avatar coverImage createdAt ${field}`);
    if (!user) throw new NotFoundException('User not found');
    const image = kind === 'avatar' ? user.avatar : user.coverImage;
    if (!image) throw new NotFoundException('No photo to show');

    const existing = await this.postsService.findProfilePhotoPost(user[field], image);
    if (existing) return { post: existing };

    const created = await this.postsService.createProfilePhotoPost(id, image, kind, {
      // external (seeded) photos have no upload date: fall back to the account's
      createdAt: uploadedAt(image) ?? (user as any).createdAt,
    });
    // Link it only if nobody else linked one meanwhile; otherwise use theirs.
    const linked = await this.userModel.findOneAndUpdate(
      { _id: id, [field]: user[field] ?? null },
      { [field]: created?._id },
      { new: true },
    );
    if (linked) return { post: created };
    await this.postsService.removeById(created?._id);
    const winner = await this.userModel.findById(id).select(field);
    return { post: await this.postsService.findProfilePhotoPost(winner?.[field], image) };
  }

  // PATCH /api/users/cover-position { position } - reposition the current cover.
  @Patch('cover-position')
  async updateCoverPosition(@CurrentUser() currentUser: UserDocument, @Body() dto: CoverPositionDto) {
    if (dto.position === undefined) throw new BadRequestException('position is required');
    const user = await this.userModel.findByIdAndUpdate(
      (currentUser as any)._id,
      { coverPosition: clampPosition(dto.position) },
      { new: true },
    );
    return { user };
  }

  // GET /api/users/:id/friends - a profile's friend list (for the Friends
  // grid/tab). Public within the app, like on Facebook. Each friend carries
  // `mutualCount`: how many friends they share with the viewer.
  @Get(':id/friends')
  async findFriends(@Param('id') id: string, @CurrentUser() viewer: UserDocument) {
    const user = await this.userModel.findById(id).populate('friends', 'name avatar friends');
    if (!user) throw new NotFoundException('User not found');

    const mine = new Set((viewer.friends || []).map((f) => f.toString()));
    const friends = (user.friends as any[]).map((f) => ({
      _id: f._id,
      name: f.name,
      avatar: f.avatar,
      mutualCount: (f.friends || []).filter((x: any) => mine.has(x.toString())).length,
    }));
    return { friends };
  }

  // GET /api/users/:id - public profile lookup, used by the Profile page.
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.userModel.findById(id).select(PROFILE_FIELDS);
    if (!user) throw new NotFoundException('User not found');
    return { user };
  }
}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

// A pending incoming friend request, embedded on the recipient's document.
@Schema({ timestamps: { createdAt: true, updatedAt: false }, _id: false })
export class FriendRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  from: Types.ObjectId;

  createdAt?: Date;
}

export const FriendRequestSchema = SchemaFactory.createForClass(FriendRequest);

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  // select: false keeps the hash out of normal find()/findById() results;
  // callers that need it (login) must explicitly .select('+password').
  @Prop({ required: true, minlength: 6, select: false })
  password: string;

  @Prop({ enum: ['user', 'admin'], default: 'user' })
  role: 'user' | 'admin';

  @Prop({ default: '' })
  avatar: string;

  @Prop({ default: '', maxlength: 300 })
  bio: string;

  @Prop({ default: '' })
  coverImage: string;

  // Vertical focus of the cover photo, 0 (top) - 100 (bottom); used as the
  // CSS object-position Y so the chosen part stays visible.
  @Prop({ default: 50, min: 0, max: 100 })
  coverPosition: number;

  // The auto-created "updated their profile picture / cover photo" posts for
  // the current photos, so viewers can react to and comment on them.
  @Prop({ type: Types.ObjectId, ref: 'Post' })
  avatarPostId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post' })
  coverPostId?: Types.ObjectId;

  // "Intro" details shown on the profile page.
  @Prop({ default: '', trim: true, maxlength: 100 })
  work: string;

  @Prop({ default: '', trim: true, maxlength: 100 })
  education: string;

  @Prop({ default: '', trim: true, maxlength: 100 })
  city: string;

  @Prop({ default: '', trim: true, maxlength: 100 })
  hometown: string;

  @Prop({ default: true })
  isActive: boolean;

  // Accepted friendships - symmetric, an id is added to both users' arrays
  // at the same time so either side is an O(1) lookup.
  // `ref` must sit on the @Prop itself (not nested inside the array element)
  // for populate() to recognize this as a ref array.
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  friends: Types.ObjectId[];

  // Incoming pending requests only. An outgoing request is discoverable by
  // checking the target user's friendRequests for an entry from the caller.
  @Prop({ type: [FriendRequestSchema], default: [] })
  friendRequests: FriendRequest[];

  // Posts bookmarked with "Save post", newest first.
  @Prop({ type: [Types.ObjectId], ref: 'Post', default: [] })
  savedPosts: Types.ObjectId[];

  // When the name was last changed; names can change once every 7 days.
  @Prop()
  lastProfileUpdateDate?: Date;

  // Forgot-password flow: hash of the emailed 6-digit code, its expiry and
  // how many wrong guesses were made. Never returned to clients.
  @Prop({ select: false })
  resetCodeHash?: string;

  @Prop({ select: false })
  resetCodeExpires?: Date;

  @Prop({ select: false, default: 0 })
  resetCodeAttempts?: number;

  // People whose stories this user has muted (hidden from their stories bar).
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  mutedUsers: Types.ObjectId[];

  // Watch feed preferences: reels marked "Not interested" and authors whose
  // reels are muted. Both are left out of GET /reels (but not profile tabs).
  @Prop({ type: [Types.ObjectId], ref: 'Reel', default: [] })
  hiddenReels: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  mutedReelAuthors: Types.ObjectId[];

  // Marks accounts created by the mock-data seed (src/database/seed.ts) so a
  // re-run can remove exactly those and nothing else.
  @Prop({ default: false, select: false })
  seeded: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Applied on every res.json() of a user document, so the password hash
// (and __v) never leak into an API response even when a query happened to
// include it (e.g. login's .select('+password')).
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    delete ret.password;
    delete ret.resetCodeHash;
    delete ret.resetCodeExpires;
    delete ret.resetCodeAttempts;
    delete ret.__v;
    return ret;
  },
});

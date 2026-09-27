import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

// Facebook's seven reactions, shared by posts, reels, comments and replies.
export const REACTION_TYPES = ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

// One user's reaction. A user has at most one reaction per target.
@Schema({ _id: false })
export class Reaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ enum: REACTION_TYPES, required: true })
  type: ReactionType;
}

export const ReactionSchema = SchemaFactory.createForClass(Reaction);

// Before reactions existed, comments stored plain `likes`; those are still
// read (as "like" reactions) but never written.
const legacyLikes = { type: [Types.ObjectId], ref: 'User', default: undefined };

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Reply {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 500 })
  content: string;

  @Prop({ type: [ReactionSchema], default: [] })
  reactions: Reaction[];

  @Prop(legacyLikes)
  likes?: Types.ObjectId[];

  // Set when the author edits the text (clients show "(edited)").
  @Prop()
  editedAt?: Date;

  createdAt?: Date;
}

export const ReplySchema = SchemaFactory.createForClass(Reply);

// A comment with one level of replies - used by both posts and reels.
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 500 })
  content: string;

  @Prop({ type: [ReactionSchema], default: [] })
  reactions: Reaction[];

  @Prop(legacyLikes)
  likes?: Types.ObjectId[];

  @Prop({ type: [ReplySchema], default: [] })
  replies: Reply[];

  @Prop()
  editedAt?: Date;

  createdAt?: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

const idOf = (u: any) => String(u?._id ?? u);

// Returns `target.reactions` with any legacy `likes` folded in as "like",
// and removes `likes` from plain (serialized) objects. Idempotent.
export function mergeLegacyLikes(target: any) {
  const reactions = [...(target.reactions || [])];
  const seen = new Set(reactions.map((r: any) => idOf(r.user)));
  for (const u of target.likes || []) {
    if (!seen.has(idOf(u))) reactions.push({ user: u, type: 'like' });
  }
  return reactions;
}

// Serializes a comment list for clients: reactions only, no `likes`.
export function serializeComments(comments: any[] = []) {
  return comments.map((c) => {
    const out = { ...c, reactions: mergeLegacyLikes(c), replies: (c.replies || []).map((r: any) => ({ ...r, reactions: mergeLegacyLikes(r) })) };
    delete out.likes;
    out.replies.forEach((r: any) => delete r.likes);
    return out;
  });
}

const stripLikes = (_doc: unknown, ret: any) => {
  ret.reactions = mergeLegacyLikes(ret);
  delete ret.likes;
  return ret;
};
ReplySchema.set('toJSON', { transform: stripLikes });
CommentSchema.set('toJSON', { transform: stripLikes });

// Sets `userId`'s reaction on a post/reel/comment/reply document. Reacting
// with the type you already have (or with no type) removes it. With
// `syncLikes`, `likes` mirrors "everyone who reacted" (posts and reels keep
// it for older readers); otherwise legacy likes are dropped once migrated.
export function applyReaction(target: any, userId: string, type: ReactionType | null | undefined, syncLikes = false) {
  const current = mergeLegacyLikes(target);
  const previous = current.find((r: any) => idOf(r.user) === userId);
  const next = type && type !== previous?.type ? type : null;
  const kept = current.filter((r: any) => idOf(r.user) !== userId);
  if (next) kept.push({ user: new Types.ObjectId(userId), type: next });
  target.set('reactions', kept);
  target.set('likes', syncLikes ? kept.map((r: any) => r.user) : undefined);
  return { mine: next as ReactionType | null, added: !!next && !previous };
}

// Finds a comment or a reply (ids are unique across both) on a document
// with a `comments` subdocument array.
export function findCommentOrReply(doc: any, id: string) {
  const comment = doc.comments.id(id);
  if (comment) return { target: comment, comment };
  for (const c of doc.comments) {
    const reply = c.replies.id(id);
    if (reply) return { target: reply, comment: c };
  }
  return null;
}

// Replaces the text of a comment or reply. Only its author may edit it.
export function editCommentOrReply(doc: any, id: string, userId: string, content: string) {
  const found = findCommentOrReply(doc, id);
  if (!found) throw new NotFoundException('Comment not found');
  if (idOf(found.target.author) !== userId) {
    throw new ForbiddenException('You can only edit your own comments');
  }
  const text = content.trim();
  if (text !== found.target.content) {
    found.target.content = text;
    found.target.editedAt = new Date();
  }
}

// { like: 3, love: 1, ... } plus the total, for compact summaries.
export function countReactions(reactions: { type: string }[]) {
  const counts: Record<string, number> = {};
  for (const r of reactions) counts[r.type] = (counts[r.type] || 0) + 1;
  return counts;
}

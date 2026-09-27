import { BadRequestException } from '@nestjs/common';
import { UserDocument } from './schemas/user.schema';

export const NAME_CHANGE_COOLDOWN_DAYS = 7;
const COOLDOWN_MS = NAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

// When `user` may change their name again (null = now).
export function nextNameChangeAt(user: UserDocument): Date | null {
  const last = user.lastProfileUpdateDate;
  if (!last) return null;
  const next = new Date(new Date(last).getTime() + COOLDOWN_MS);
  return next > new Date() ? next : null;
}

// Sets a new name, enforcing the 7-day cooldown. A no-op when unchanged.
export function applyNameChange(user: UserDocument, name: string) {
  const next = name.replace(/\s+/g, ' ').trim();
  if (!next || next === user.name) return;
  if (nextNameChangeAt(user)) {
    throw new BadRequestException(`You cannot change your name again for ${NAME_CHANGE_COOLDOWN_DAYS} days.`);
  }
  user.name = next;
  user.lastProfileUpdateDate = new Date();
}

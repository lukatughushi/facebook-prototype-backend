import { IsIn, IsOptional } from 'class-validator';
import { REACTION_TYPES, ReactionType } from '../schemas/post.schema';

export class ReactDto {
  // Omitted/null removes the caller's reaction.
  @IsOptional()
  @IsIn(REACTION_TYPES)
  type?: ReactionType | null;
}

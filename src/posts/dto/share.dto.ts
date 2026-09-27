import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AUDIENCES, Audience } from '../schemas/post.schema';

// Optional caption + audience for the new post a share creates.
export class ShareDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsIn(AUDIENCES)
  audience?: Audience;
}

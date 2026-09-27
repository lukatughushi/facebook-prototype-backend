import { IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { AUDIENCES, Audience } from '../schemas/post.schema';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsIn(AUDIENCES)
  audience?: Audience;

  @IsOptional()
  @IsMongoId()
  group?: string;

  @IsOptional()
  @IsMongoId()
  page?: string;
}

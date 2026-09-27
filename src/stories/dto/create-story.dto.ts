import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  text?: string;
}

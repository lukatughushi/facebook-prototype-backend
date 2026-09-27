import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdatePostDto {
  @IsString()
  @IsNotEmpty({ message: 'Post content cannot be empty' })
  @MaxLength(5000)
  content: string;
}

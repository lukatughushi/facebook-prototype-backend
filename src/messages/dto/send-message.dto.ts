import { IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  @MaxLength(2000)
  text: string;

  // Marketplace listing this message is about; lets a buyer message a
  // seller they aren't friends with.
  @IsOptional()
  @IsMongoId()
  itemId?: string;
}

import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty({ message: 'Event name is required' })
  @MaxLength(100)
  title: string;

  @IsDateString({}, { message: 'Pick a valid start date and time' })
  startsAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

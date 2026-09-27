import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// PATCH /api/users/profile - Settings > Personal information.
export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(40)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address' })
  email?: string;

  // Required when changing the email.
  @IsOptional()
  @IsString()
  currentPassword?: string;
}

import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;
}

export class VerifyResetCodeDto extends ForgotPasswordDto {
  @IsString()
  @Length(6, 6, { message: 'The code has 6 digits' })
  @Matches(/^\d{6}$/, { message: 'The code has 6 digits' })
  code: string;
}

export class ResetPasswordDto extends VerifyResetCodeDto {
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  newPassword: string;
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto, ResetPasswordDto, VerifyResetCodeDto } from './dto/password-reset.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { multerOptions } from '../common/multer.config';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // In production the frontend (Vercel) and API (Render) live on different
  // sites, so the cookie must be SameSite=None (which in turn requires Secure).
  private cookieOptions() {
    const isProd = this.configService.get('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ('none' as const) : ('lax' as const),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  @Post('register')
  @UseInterceptors(FileInterceptor('avatar', multerOptions))
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const { user, token } = await this.authService.register(dto, file ? `/uploads/${file.filename}` : undefined);
    res.cookie('token', token, this.cookieOptions());
    return { user, token };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.authService.login(dto);
    res.cookie('token', token, this.cookieOptions());
    return { user, token };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', { ...this.cookieOptions(), maxAge: 0 });
    return { message: 'Logged out' };
  }

  // POST /api/auth/change-password { currentPassword, newPassword }
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(200)
  changePassword(@CurrentUser() user: UserDocument, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword((user as any)._id.toString(), dto);
  }

  // Forgot password: request a code -> verify it -> set a new password.
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-reset-code')
  @HttpCode(200)
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: UserDocument) {
    return { user };
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'coverImage', maxCount: 1 },
      ],
      multerOptions,
    ),
  )
  async updateMe(
    @CurrentUser() currentUser: UserDocument,
    @Body() dto: UpdateProfileDto,
    @UploadedFiles() files?: { avatar?: Express.Multer.File[]; coverImage?: Express.Multer.File[] },
  ) {
    const user = await this.authService.updateProfile((currentUser as any)._id.toString(), dto, {
      avatar: files?.avatar?.[0] ? `/uploads/${files.avatar[0].filename}` : undefined,
      coverImage: files?.coverImage?.[0] ? `/uploads/${files.coverImage[0].filename}` : undefined,
    });
    return { user };
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { applyNameChange } from '../users/name-change';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto, ResetPasswordDto, VerifyResetCodeDto } from './dto/password-reset.dto';

const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;
const RESET_FIELDS = '+resetCodeHash +resetCodeExpires +resetCodeAttempts';
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private generateToken(user: UserDocument) {
    return this.jwtService.sign({ id: user._id, role: user.role });
  }

  async register(dto: RegisterDto, avatarPath?: string) {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      avatar: avatarPath || '',
    });

    return { user, token: this.generateToken(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() }).select('+password');
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new ForbiddenException('This account has been blocked by an administrator');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return { user, token: this.generateToken(user) };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    files: { avatar?: string; coverImage?: string },
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (dto.name) applyNameChange(user, dto.name);
    if (dto.bio !== undefined) user.bio = dto.bio;
    for (const field of ['work', 'education', 'city', 'hometown'] as const) {
      if (dto[field] !== undefined) user[field] = dto[field];
    }
    if (files.avatar) user.avatar = files.avatar;
    if (files.coverImage) user.coverImage = files.coverImage;

    await user.save();
    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId).select('+password');
    if (!user) throw new NotFoundException('User not found');
    if (!(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new BadRequestException('Your current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Choose a password you are not already using');
    }
    user.password = await bcrypt.hash(dto.newPassword, 10);
    await user.save();
    return { message: 'Password changed' };
  }

  // Step 1 of "Forgot password": creates a 6-digit code valid for 10
  // minutes. There is no mail server, so the code is written to the server
  // log - and returned as `devCode` so the demo UI can show it. That is on
  // by default outside production; SHOW_RESET_CODE=true|false overrides it
  // (e.g. on Render). Anyone who knows an email address can then reset that
  // account, so admin accounts never get their code exposed. For unknown
  // emails the response stays generic. While codes are exposed, the code is
  // the fixed DEMO_RESET_CODE (default 123456) so testers can always use it.
  async forgotPassword(dto: ForgotPasswordDto) {
    const generic = { message: 'If an account exists for this email, we sent a 6-digit code to it.' };
    const email = dto.email.toLowerCase().trim();
    const user = await this.userModel.findOne({ email }).select(RESET_FIELDS);
    if (!user || !user.isActive) return generic;

    const flag = this.configService.get<string>('SHOW_RESET_CODE');
    const exposeCode =
      (flag ? flag.trim().toLowerCase() === 'true' : this.configService.get('NODE_ENV') !== 'production') &&
      user.role !== 'admin';
    const demoCode = this.configService.get<string>('DEMO_RESET_CODE')?.trim();
    const code = exposeCode
      ? /^\d{6}$/.test(demoCode || '') ? demoCode! : '123456'
      : String(randomInt(0, 1_000_000)).padStart(6, '0');
    user.resetCodeHash = sha256(code);
    user.resetCodeExpires = new Date(Date.now() + RESET_CODE_TTL_MS);
    user.resetCodeAttempts = 0;
    await user.save();

    this.logger.log(`Password reset code for ${email}: ${code}`);
    return exposeCode ? { ...generic, devCode: code } : generic;
  }

  // Checks a code; wrong guesses count towards the attempt limit.
  private async checkResetCode(dto: VerifyResetCodeDto) {
    const invalid = new BadRequestException('That code is incorrect or has expired. Request a new one.');
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase().trim() }).select(RESET_FIELDS);
    if (!user?.resetCodeHash || !user.resetCodeExpires || user.resetCodeExpires < new Date()) throw invalid;
    if ((user.resetCodeAttempts || 0) >= RESET_CODE_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts. Request a new code.');
    }

    const matches = timingSafeEqual(Buffer.from(sha256(dto.code)), Buffer.from(user.resetCodeHash));
    if (!matches) {
      user.resetCodeAttempts = (user.resetCodeAttempts || 0) + 1;
      await user.save();
      throw invalid;
    }
    return user;
  }

  // Step 2: lets the UI move on to the new-password form.
  async verifyResetCode(dto: VerifyResetCodeDto) {
    await this.checkResetCode(dto);
    return { valid: true };
  }

  // Step 3: re-checks the code, sets the password and burns the code.
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.checkResetCode(dto);
    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.resetCodeHash = undefined;
    user.resetCodeExpires = undefined;
    user.resetCodeAttempts = 0;
    await user.save();
    return { message: 'Your password has been reset. You can log in now.' };
  }
}

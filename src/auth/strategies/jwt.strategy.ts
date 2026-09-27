import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { User, UserDocument } from '../../users/schemas/user.schema';

interface JwtPayload {
  id: string;
  role: string;
}

// Accepts the token either as an HttpOnly "token" cookie or as a
// "Bearer <token>" Authorization header, so the frontend can use whichever
// storage strategy (cookie vs localStorage) it prefers.
const cookieExtractor = (req: Request): string | null => req?.cookies?.token || null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<UserDocument> {
    const user = await this.userModel.findById(payload.id);
    if (!user) {
      throw new UnauthorizedException('Not authorized, user no longer exists');
    }
    if (!user.isActive) {
      throw new ForbiddenException('This account has been blocked by an administrator');
    }
    return user;
  }
}

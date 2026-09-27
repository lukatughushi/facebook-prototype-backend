import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Wraps the 'jwt' passport strategy (see auth/strategies/jwt.strategy.ts) so
// every guarded route gets a consistent "not authorized" error shape.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException(info?.message || 'Not authorized, invalid or missing token');
    }
    return user;
  }
}

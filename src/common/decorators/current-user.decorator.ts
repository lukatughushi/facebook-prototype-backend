import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Pulls the authenticated user (attached by JwtStrategy) off the request.
export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});

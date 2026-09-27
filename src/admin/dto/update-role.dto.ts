import { IsIn } from 'class-validator';

export class UpdateRoleDto {
  @IsIn(['user', 'admin'], { message: "Role must be 'user' or 'admin'" })
  role: 'user' | 'admin';
}

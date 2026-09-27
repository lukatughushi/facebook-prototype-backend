import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Patch('users/:id/status')
  toggleStatus(@Param('id') id: string, @CurrentUser() requester: UserDocument) {
    return this.adminService.toggleUserStatus(id, (requester as any)._id.toString());
  }

  @Patch('users/:id/role')
  changeRole(@Param('id') id: string, @CurrentUser() requester: UserDocument, @Body() dto: UpdateRoleDto) {
    return this.adminService.changeUserRole(id, (requester as any)._id.toString(), dto);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @CurrentUser() requester: UserDocument) {
    return this.adminService.deleteUser(id, (requester as any)._id.toString());
  }

  @Get('posts')
  listPosts() {
    return this.adminService.listPosts();
  }

  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.adminService.deletePost(id);
  }
}

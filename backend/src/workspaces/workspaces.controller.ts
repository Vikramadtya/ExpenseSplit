import { Body, Controller, Get, HttpCode, Param, Post, Patch, Delete, Req } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { Roles } from '../auth/decorators';

interface RequestWithUser extends Request {
  user: { id: string };
}

@Controller('api/v1')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('workspaces')
  async listWorkspaces(@Req() request: RequestWithUser) {
    return this.workspacesService.listWorkspaces(request.user.id);
  }

  @Post('workspaces')
  @HttpCode(201)
  async createWorkspace(@Req() request: RequestWithUser, @Body() body: CreateWorkspaceDto) {
    return this.workspacesService.createWorkspace(
      body.name,
      body.defaultCurrency || 'USD',
      request.user.id,
    );
  }

  @Get('workspaces/:workspaceId')
  async getWorkspace(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getWorkspace(workspaceId);
  }

  @Get('workspaces/:workspaceId/members')
  async getMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getMembers(workspaceId);
  }

  @Post('workspaces/:workspaceId/members')
  @Roles('ADMIN')
  @HttpCode(201)
  async inviteMember(@Param('workspaceId') workspaceId: string, @Body() body: InviteMemberDto) {
    return this.workspacesService.inviteMember(workspaceId, body.email);
  }

  @Get('workspaces/:workspaceId/activity')
  async getActivity(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getActivity(workspaceId);
  }

  @Patch('workspaces/:workspaceId')
  @Roles('ADMIN')
  async updateWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Body() body: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.updateWorkspace(workspaceId, body);
  }

  @Delete('workspaces/:workspaceId')
  @Roles('ADMIN')
  @HttpCode(204)
  async deleteWorkspace(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.deleteWorkspace(workspaceId);
  }

  @Delete('workspaces/:workspaceId/members/:userId')
  @Roles('ADMIN')
  @HttpCode(204)
  async removeMember(@Param('workspaceId') workspaceId: string, @Param('userId') userId: string) {
    return this.workspacesService.removeMember(workspaceId, userId);
  }
}

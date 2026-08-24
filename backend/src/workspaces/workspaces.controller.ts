import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('workspaces')
  @UseGuards(JwtAuthGuard)
  async listWorkspaces(@Req() request: Request) {
    return this.workspacesService.listWorkspaces((request as any).user.id);
  }

  @Post('workspaces')
  @HttpCode(201)
  async createWorkspace(@Body() body: CreateWorkspaceDto) {
    return this.workspacesService.createWorkspace(
      (body as any).name,
      (body as any).defaultCurrency || 'USD',
      'dev-user-id',
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
  @HttpCode(201)
  async inviteMember(@Param('workspaceId') workspaceId: string, @Body() body: InviteMemberDto) {
    return this.workspacesService.inviteMember(workspaceId, (body as any).email);
  }

  @Get('workspaces/:workspaceId/activity')
  @UseGuards(JwtAuthGuard)
  async getActivity(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getActivity(workspaceId);
  }
}

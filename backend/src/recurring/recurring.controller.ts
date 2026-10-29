import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { Role } from '../common/interfaces/repository.interfaces';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { RecurringService } from './recurring.service';

export class SetActiveDto extends createZodDto(z.object({ active: z.boolean() })) {}

type Authed = { user: { id: string }; workspaceRole: Role };

@Controller('api/v1/workspaces/:workspaceId/recurring')
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Get()
  list(@Param('workspaceId') workspaceId: string) {
    return this.recurring.list(workspaceId);
  }

  @Post()
  @HttpCode(201)
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateRecurringDto,
    @Req() req: Authed,
  ) {
    return this.recurring.create(workspaceId, req.user.id, dto);
  }

  @Post(':ruleId/skip')
  @HttpCode(200)
  skip(@Param('workspaceId') workspaceId: string, @Param('ruleId', ParseUUIDPipe) ruleId: string) {
    return this.recurring.skipNext(workspaceId, ruleId);
  }

  @Patch(':ruleId')
  setActive(
    @Param('workspaceId') workspaceId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: SetActiveDto,
    @Req() req: Authed,
  ) {
    return this.recurring.setActive(
      workspaceId,
      ruleId,
      dto.active,
      req.user.id,
      req.workspaceRole,
    );
  }

  @Delete(':ruleId')
  @HttpCode(204)
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Req() req: Authed,
  ) {
    return this.recurring.remove(workspaceId, ruleId, req.user.id, req.workspaceRole);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CommentsService } from './comments.service';

export class CreateCommentDto extends createZodDto(
  z.object({ body: z.string().trim().min(1).max(2000) }),
) {}

type AuthedRequest = { user: { id: string } };

@Controller('api/v1')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('expenses/:expenseId/comments')
  list(@Param('expenseId', ParseUUIDPipe) expenseId: string, @Req() req: AuthedRequest) {
    return this.comments.list(expenseId, req.user.id);
  }

  @Post('expenses/:expenseId/comments')
  @HttpCode(201)
  add(
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.comments.add(expenseId, req.user.id, dto.body);
  }

  @Delete('comments/:commentId')
  @HttpCode(204)
  remove(@Param('commentId', ParseUUIDPipe) commentId: string, @Req() req: AuthedRequest) {
    return this.comments.remove(commentId, req.user.id);
  }
}

import { Injectable, Inject } from '@nestjs/common';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { ISettlementsRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { ISettlementsRepository } from '../common/interfaces/repository.interfaces';

@Injectable()
export class SettlementsService {
  constructor(
    @Inject(ISettlementsRepositoryToken)
    private readonly repository: ISettlementsRepository,
  ) {}

  async listSettlements(workspaceId: string) {
    return this.repository.findByWorkspace(workspaceId);
  }

  async recordSettlement(workspaceId: string, dto: CreateSettlementDto) {
    return this.repository.create(workspaceId, dto);
  }
}

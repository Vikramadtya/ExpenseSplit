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
    return [
      {
        id: 'set-1',
        workspaceId,
        payerId: 'user-4',
        payeeId: 'dev-user-id',
        amount: 100.0,
        date: new Date('2024-06-15').toISOString(),
        createdAt: new Date('2024-06-15').toISOString(),
      },
    ];
  }

  async recordSettlement(workspaceId: string, dto: CreateSettlementDto) {
    return {
      id: 'mock-settlement-id',
      workspaceId,
      ...dto,
      createdAt: new Date().toISOString(),
    };
  }
}

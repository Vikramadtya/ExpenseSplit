import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IWorkspacesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IWorkspacesRepository } from '../common/interfaces/repository.interfaces';

const MOCK_WORKSPACES = [
  {
    id: 'ws-1',
    name: 'Summer Trip 2024',
    defaultCurrency: 'USD',
    createdAt: new Date('2024-06-01').toISOString(),
  },
  {
    id: 'ws-2',
    name: 'Apartment 4B',
    defaultCurrency: 'EUR',
    createdAt: new Date('2023-09-01').toISOString(),
  },
  {
    id: 'ws-3',
    name: 'Weekend Getaway',
    defaultCurrency: 'USD',
    createdAt: new Date('2024-03-15').toISOString(),
  },
];

const MOCK_MEMBERS = [
  { id: 'dev-user-id', name: 'Alex (You)', email: 'alex@example.com' },
  { id: 'user-2', name: 'Sarah', email: 'sarah@example.com' },
  { id: 'user-3', name: 'Mike', email: 'mike@example.com' },
  { id: 'user-4', name: 'Emma', email: 'emma@example.com' },
];

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(IWorkspacesRepositoryToken)
    private readonly repository: IWorkspacesRepository,
  ) {}

  async listWorkspaces(userId: string) {
    this.repository.findAll(userId);
    return MOCK_WORKSPACES;
  }

  async createWorkspace(name: string, defaultCurrency: string, userId: string) {
    return {
      id: 'ws-new',
      name,
      defaultCurrency: defaultCurrency || 'USD',
      createdAt: new Date().toISOString(),
    };
  }

  async getWorkspace(id: string) {
    return MOCK_WORKSPACES.find((w) => w.id === id) || MOCK_WORKSPACES[0];
  }

  async inviteMember(workspaceId: string, email: string) {
    const userExists = MOCK_MEMBERS.some((m) => m.email.toLowerCase() === email.toLowerCase());
    if (!userExists) {
      throw new NotFoundException('User not found. They must sign up first.');
    }
    return { success: true };
  }

  async getMembers(workspaceId: string) {
    return MOCK_MEMBERS;
  }

  async getActivity(workspaceId: string) {
    // TODO: Fetch expenses and settlements ordered by date descending
    return [
      {
        id: 'act-1',
        type: 'EXPENSE',
        description: "Dinner at Mario's",
        amount: 85.0,
        date: new Date().toISOString(),
        actionBy: 'Dev User',
      },
      {
        id: 'act-2',
        type: 'SETTLEMENT',
        description: 'Paid back Alice',
        amount: 25.0,
        date: new Date(Date.now() - 86400000).toISOString(),
        actionBy: 'Dev User',
      },
    ];
  }
}

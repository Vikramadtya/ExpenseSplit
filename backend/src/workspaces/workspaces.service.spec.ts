import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesRepository } from './workspaces.repository';
import { BadRequestException } from '@nestjs/common';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let repository: jest.Mocked<WorkspacesRepository>;

  beforeEach(async () => {
    // Create a mock repository
    const mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByName: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        {
          provide: WorkspacesRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
    repository = module.get(WorkspacesRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWorkspace', () => {
    it('should create a workspace if the name is available', async () => {
      repository.findByName.mockResolvedValue(null); // Name is available
      repository.create.mockResolvedValue({
        id: 'uuid-1',
        name: 'New Workspace',
      } as any);

      const result = await service.create({ name: 'New Workspace' });

      expect(repository.findByName).toHaveBeenCalledWith('New Workspace');
      expect(repository.create).toHaveBeenCalledWith({ name: 'New Workspace' });
      expect(result).toEqual({ id: 'uuid-1', name: 'New Workspace' });
    });

    it('should throw BadRequestException if the name is already taken', async () => {
      repository.findByName.mockResolvedValue({
        id: 'uuid-2',
        name: 'Taken Workspace',
      } as any);

      await expect(service.create({ name: 'Taken Workspace' })).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SettlementsController } from './settlements.controller';

describe('SettlementsController', () => {
  let controller: SettlementsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettlementsController],
    }).compile();

    controller = module.get<SettlementsController>(SettlementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

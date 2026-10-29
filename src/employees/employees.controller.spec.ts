import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

describe('EmployeesController', () => {
  let controller: EmployeesController;

  const employeesServiceMock = {
    create: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        {
          provide: EmployeesService,
          useValue: employeesServiceMock,
        },
      ],
    }).compile();

    controller = module.get(EmployeesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

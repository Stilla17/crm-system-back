import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EmployeesService } from './employees.service.js';
import { Employee, EmployeeGender } from './schemas/employee.schema.js';
import { UsersService } from '../users/users.service.js';
import { VerifixService } from '../verifix/verifix.service.js';
import { CompaniesService } from '../companies/companies.service.js';
import { BadGatewayException } from '@nestjs/common';

describe('EmployeesService', () => {
  let service: EmployeesService;

  const employeeModelMock = {
    findOne: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    bulkWrite: vi.fn(),
    db: {
      startSession: vi.fn(),
    },
  };

  const usersServiceMock = {
    getUserByIdForCompany: vi.fn(),
    getAllUsers: vi.fn(),
    updateEmployeeProfile: vi.fn(),
    moveUserToCompany: vi.fn(),
  };

  const verifixServiceMock = {
    createEmployee: vi.fn(),
    listAllEmployees: vi.fn(),
    listEmployeeTracks: vi.fn(),
    getEmployeePaymentsByTime: vi.fn(),
    updateEmployee: vi.fn(),
  };

  const companiesServiceMock = {
    findActiveCompanyById: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: getModelToken(Employee.name),
          useValue: employeeModelMock,
        },
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: VerifixService,
          useValue: verifixServiceMock,
        },
        {
          provide: CompaniesService,
          useValue: companiesServiceMock,
        },
      ],
    }).compile();

    service = module.get(EmployeesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return daily attendance from Verifix tracks', async () => {
    employeeModelMock.findOne.mockResolvedValue({
      id: 'employee-id',
      companyId: 'company-id',
      verifixEmployeeId: '42',
    });
    verifixServiceMock.listEmployeeTracks.mockResolvedValue([
      {
        track_id: '1',
        employee_id: '42',
        track_type: 'I',
        track_datetime: '03.11.2026 09:07:00',
      },
      {
        track_id: '2',
        employee_id: '42',
        track_type: 'C',
        track_datetime: '03.11.2026 13:00:00',
      },
      {
        track_id: '3',
        employee_id: '42',
        track_type: 'O',
        track_datetime: '03.11.2026 18:12:00',
      },
    ]);

    const result = await service.getAttendance(
      'employee-id',
      'company-id',
      { from: '2026-11-01', to: '2026-11-30' },
    );

    expect(verifixServiceMock.listEmployeeTracks).toHaveBeenCalledWith(
      '42',
      '01.11.2026 00:00:00',
      '30.11.2026 23:59:59',
    );
    expect(result).toEqual({
      period: { from: '2026-11-01', to: '2026-11-30' },
      summary: {
        recordedDays: 1,
        daysWithCheckIn: 1,
        totalTrackEvents: 3,
      },
      items: [
        {
          date: '2026-11-03',
          checkInAt: '2026-11-03T09:07:00+05:00',
          checkOutAt: '2026-11-03T18:12:00+05:00',
          trackCount: 3,
        },
      ],
    });
  });

  it('should return normalized salary data from Verifix', async () => {
    employeeModelMock.findOne.mockResolvedValue({
      id: 'employee-id',
      companyId: 'company-id',
      verifixEmployeeId: '42',
    });
    verifixServiceMock.getEmployeePaymentsByTime.mockResolvedValue({
      employees: [
        {
          employee_id: '42',
          staff_id: '84',
          employee_name: 'Hidden from CRM response',
          days: [
            {
              job_id: '7',
              date: '03.11.2026',
              plan_time_seconds: '28800',
              day_kind: 'W',
              day_kind_name: 'Ish kuni',
              wage: '125000',
              intervals: [
                {
                  input_id: '1',
                  input_location_id: '10',
                  input_location_name: 'Office',
                  input_time: '09:00:00',
                  output_id: '2',
                  output_location_id: '10',
                  output_location_name: 'Office',
                  output_time: '18:00:00',
                  turnout_time: '28800',
                  wage_amount: '120000',
                  overtime_time: '3600',
                  overtime_amount: '5000',
                },
              ],
            },
          ],
        },
      ],
    });

    const result = await service.getSalary('employee-id', 'company-id', {
      from: '2026-11-01',
      to: '2026-11-30',
    });

    expect(verifixServiceMock.getEmployeePaymentsByTime).toHaveBeenCalledWith(
      '42',
      '01.11.2026',
      '30.11.2026',
    );
    expect(result).toEqual({
      period: { from: '2026-11-01', to: '2026-11-30' },
      staffId: '84',
      summary: {
        totalWage: 125000,
        plannedTimeSeconds: 28800,
        turnoutTimeSeconds: 28800,
        overtimeTimeSeconds: 3600,
        overtimeAmount: 5000,
        workedDays: 1,
      },
      days: [
        {
          date: '2026-11-03',
          jobId: '7',
          planTimeSeconds: 28800,
          dayKind: 'W',
          dayKindName: 'Ish kuni',
          wage: 125000,
          intervals: [
            {
              inputId: '1',
              inputLocationId: '10',
              inputLocationName: 'Office',
              inputTime: '09:00:00',
              outputId: '2',
              outputLocationId: '10',
              outputLocationName: 'Office',
              outputTime: '18:00:00',
              turnoutTimeSeconds: 28800,
              wageAmount: 120000,
              overtimeTimeSeconds: 3600,
              overtimeAmount: 5000,
            },
          ],
        },
      ],
    });
  });

  it('should sync a pending employee to Verifix', async () => {
    const employee = {
      id: 'employee-id',
      companyId: 'company-id',
      firstName: 'Ali',
      lastName: 'Valiyev',
      middleName: null,
      gender: 'M',
      phone: '+998901234567',
      birthDate: '15.05.1995',
    };

    const syncedEmployee = {
      ...employee,
      verifixEmployeeId: '123',
      syncStatus: 'synced',
    };

    employeeModelMock.findOneAndUpdate
      .mockResolvedValueOnce(employee)
      .mockResolvedValueOnce(syncedEmployee);
    verifixServiceMock.createEmployee.mockResolvedValue({
      employee_id: 123,
    });

    const result = await service.syncToVerifix('employee-id', 'company-id');

    expect(verifixServiceMock.createEmployee).toHaveBeenCalledWith({
      firstName: 'Ali',
      lastName: 'Valiyev',
      middleName: null,
      gender: 'M',
      phone: '+998901234567',
      birthDate: '15.05.1995',
    });
    expect(result).toEqual(syncedEmployee);
  });

  it('should link a new CRM user to an already imported Verifix employee', async () => {
    const importedEmployee = {
      id: 'imported-employee-id',
      companyId: 'company-id',
      userId: null,
      verifixEmployeeId: '42',
      phone: '+998901234567',
      syncStatus: 'synced',
    };
    const employeeWithUser = {
      ...importedEmployee,
      userId: 'user-id',
    };

    usersServiceMock.getUserByIdForCompany.mockResolvedValue({ id: 'user-id' });
    employeeModelMock.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(importedEmployee);
    employeeModelMock.findOneAndUpdate.mockResolvedValue(employeeWithUser);
    employeeModelMock.aggregate.mockResolvedValue([employeeWithUser]);

    const result = await service.create(
      {
        userId: 'user-id',
        firstName: 'Ali',
        lastName: 'Valiyev',
        gender: EmployeeGender.MALE,
        phone: '+998 90 123 45 67',
      },
      'company-id',
    );

    expect(employeeModelMock.findOneAndUpdate).toHaveBeenCalledWith(
      {
        id: 'imported-employee-id',
        companyId: 'company-id',
        userId: null,
      },
      {
        $set: {
          userId: 'user-id',
          syncStatus: 'synced',
          syncError: null,
        },
      },
      { new: true },
    );
    expect(employeeModelMock.create).not.toHaveBeenCalled();
    expect(verifixServiceMock.createEmployee).not.toHaveBeenCalled();
    expect(result).toEqual(employeeWithUser);
  });

  it('should mark an employee as failed when Verifix rejects the request', async () => {
    const employee = {
      id: 'employee-id',
      companyId: 'company-id',
      firstName: 'Ali',
      lastName: 'Valiyev',
      middleName: null,
      gender: 'M',
      phone: '+998901234567',
      birthDate: '15.05.1995',
    };

    employeeModelMock.findOneAndUpdate.mockResolvedValueOnce(employee);
    verifixServiceMock.createEmployee.mockRejectedValue(
      new Error('Verifix unavailable'),
    );
    employeeModelMock.updateOne.mockResolvedValue({ acknowledged: true });

    await expect(
      service.syncToVerifix('employee-id', 'company-id'),
    ).rejects.toThrow('Verifix unavailable');

    expect(employeeModelMock.updateOne).toHaveBeenCalledWith(
      {
        id: 'employee-id',
        companyId: 'company-id',
      },
      {
        $set: {
          syncStatus: 'failed',
          syncError: 'Verifix unavailable',
        },
      },
    );
  });

  it('should link an existing active Verifix employee when the phone already exists', async () => {
    const employee = {
      id: 'employee-id',
      companyId: 'company-id',
      firstName: 'Ali',
      lastName: 'Valiyev',
      middleName: null,
      gender: 'M',
      phone: '+998901234567',
      birthDate: '15.05.1995',
    };
    const linkedEmployee = {
      ...employee,
      verifixEmployeeId: '42',
      syncStatus: 'synced',
    };

    employeeModelMock.findOneAndUpdate
      .mockResolvedValueOnce(employee)
      .mockResolvedValueOnce(linkedEmployee);
    verifixServiceMock.createEmployee.mockRejectedValue(
      new BadGatewayException({
        message: 'Verifix API xatosi',
        upstreamStatus: 500,
        details:
          'Z:Запись с такими же значениями уже существует в "Лицо" (phone = 998901234567, state = A)',
      }),
    );
    verifixServiceMock.listAllEmployees.mockResolvedValue([
      {
        employee_id: 42,
        first_name: 'Ali',
        last_name: 'Valiyev',
        gender: 'M',
        phone_number: '998 90 123 45 67',
        state: 'A',
      },
    ]);

    const result = await service.syncToVerifix('employee-id', 'company-id');

    expect(verifixServiceMock.listAllEmployees).toHaveBeenCalledOnce();
    expect(employeeModelMock.findOneAndUpdate).toHaveBeenLastCalledWith(
      {
        id: 'employee-id',
        companyId: 'company-id',
      },
      {
        $set: expect.objectContaining({
          verifixEmployeeId: '42',
          syncStatus: 'synced',
          syncError: null,
        }),
      },
      { new: true },
    );
    expect(employeeModelMock.updateOne).not.toHaveBeenCalled();
    expect(result).toEqual(linkedEmployee);
  });

  it('should import Verifix employees and link a matching CRM user by phone', async () => {
    verifixServiceMock.listAllEmployees.mockResolvedValue([
      {
        employee_id: 42,
        first_name: 'Ali',
        last_name: 'Valiyev',
        middle_name: null,
        gender: 'M',
        phone_number: '+998 90 123 45 67',
        birthday: '15.05.1995',
        job_id: 7,
        division_id: 3,
      },
    ]);
    usersServiceMock.getAllUsers.mockResolvedValue([
      {
        id: 'user-id',
        phone: '+998901234567',
      },
    ]);
    employeeModelMock.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    employeeModelMock.bulkWrite.mockResolvedValue({
      upsertedCount: 1,
      matchedCount: 0,
    });

    const result = await service.importFromVerifix('company-id');

    expect(employeeModelMock.bulkWrite).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: {
              companyId: 'company-id',
              verifixEmployeeId: '42',
            },
            update: expect.objectContaining({
              $set: expect.objectContaining({
                userId: 'user-id',
                firstName: 'Ali',
                lastName: 'Valiyev',
                phone: '+998901234567',
                syncStatus: 'synced',
              }),
            }),
            upsert: true,
          }),
        }),
      ]),
      { ordered: false },
    );
    expect(result).toEqual({
      received: 1,
      created: 1,
      updated: 0,
      linkedToUsers: 1,
      skipped: 0,
    });
  });

  it('should update Verifix, Employee and its linked CRM user', async () => {
    const employee = {
      id: 'employee-id',
      companyId: 'company-id',
      userId: 'user-id',
      verifixEmployeeId: '42',
      firstName: 'Ali',
      lastName: 'Valiyev',
      middleName: null,
      gender: 'M',
      phone: '+998901234567',
      birthDate: '15.05.1995',
      jobId: null,
      divisionId: null,
      locationIds: [],
    };
    const updatedEmployee = {
      ...employee,
      firstName: 'Alisher',
    };

    employeeModelMock.findOne.mockResolvedValue(employee);
    verifixServiceMock.updateEmployee.mockResolvedValue(undefined);
    employeeModelMock.findOneAndUpdate.mockResolvedValue(updatedEmployee);
    usersServiceMock.updateEmployeeProfile.mockResolvedValue({});
    employeeModelMock.aggregate.mockResolvedValue([updatedEmployee]);

    const result = await service.update(
      'employee-id',
      { firstName: 'Alisher', roleId: 'new-role-id' },
      'company-id',
    );

    expect(verifixServiceMock.updateEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: '42',
        firstName: 'Alisher',
        lastName: 'Valiyev',
      }),
    );
    expect(usersServiceMock.updateEmployeeProfile).toHaveBeenCalledWith(
      'user-id',
      'company-id',
      expect.objectContaining({
        name: 'Alisher',
        middleName: 'Valiyev',
        roleId: 'new-role-id',
      }),
    );
    expect(result).toEqual(updatedEmployee);
  });

  it('should move Employee and linked User to another company atomically', async () => {
    const employee = {
      id: 'employee-id',
      companyId: 'source-company-id',
      userId: 'user-id',
      verifixEmployeeId: '42',
    };
    const movedEmployee = {
      ...employee,
      companyId: 'target-company-id',
    };
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
      endSession: vi.fn(),
    };

    employeeModelMock.findOne
      .mockResolvedValueOnce(employee)
      .mockResolvedValueOnce(null);
    companiesServiceMock.findActiveCompanyById.mockResolvedValue({
      id: 'target-company-id',
    });
    employeeModelMock.db.startSession.mockResolvedValue(session);
    employeeModelMock.findOneAndUpdate.mockResolvedValue(movedEmployee);
    usersServiceMock.moveUserToCompany.mockResolvedValue({});
    employeeModelMock.aggregate.mockResolvedValue([movedEmployee]);

    const result = await service.moveToCompany(
      'employee-id',
      'source-company-id',
      'target-company-id',
    );

    expect(usersServiceMock.moveUserToCompany).toHaveBeenCalledWith(
      'user-id',
      'source-company-id',
      'target-company-id',
      session,
    );
    expect(session.withTransaction).toHaveBeenCalledOnce();
    expect(session.endSession).toHaveBeenCalledOnce();
    expect(result).toEqual(movedEmployee);
  });
});

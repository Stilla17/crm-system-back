import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { EmployeeListQueryDto } from './dto/employee-list-query.dto.js';
import {
  Employee,
  EmployeeSource,
  EmployeeSyncStatus,
} from './schemas/employee.schema.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UsersService } from '../users/users.service.js';
import { VerifixService } from '../verifix/verifix.service.js';
import { VerifixEmployee } from '../verifix/types/verifix-employee.type.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { CompaniesService } from '../companies/companies.service.js';
import { EmployeeAttendanceQueryDto } from './dto/employee-attendance-query.dto.js';
import { VerifixTrack } from '../verifix/types/verifix-track.type.js';
import { EmployeeSalaryQueryDto } from './dto/employee-salary-query.dto.js';
import type {
  VerifixPaymentDay,
  VerifixPaymentInterval,
} from '../verifix/types/verifix-payment.type.js';

const VERIFIX_DATE_TIME_PATTERN =
  /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/;

const toVerifixDateTime = (value: string, endOfDay = false) => {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year} ${endOfDay ? '23:59:59' : '00:00:00'}`;
};

const parseVerifixTrackDateTime = (value: string) => {
  const match = VERIFIX_DATE_TIME_PATTERN.exec(value);

  if (!match) {
    throw new BadRequestException(
      `Verifix track_datetime formati noto\u2018g\u2018ri: ${value}`,
    );
  }

  const [, day, month, year, hour, minute, second] = match;

  return {
    date: `${year}-${month}-${day}`,
    iso: `${year}-${month}-${day}T${hour}:${minute}:${second}+05:00`,
  };
};

const toVerifixDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
};

const parseVerifixDate = (value: string) => {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);

  if (!match) {
    throw new BadGatewayException(
      `Verifix salary sanasi noto\u2018g\u2018ri formatda qaytdi: ${value}`,
    );
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
};

const parseVerifixAmount = (
  value: string | number | null | undefined,
  field: string,
) => {
  if (value === null || value === undefined || value === '') return 0;

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new BadGatewayException(
      `Verifix ${field} maydoni noto\u2018g\u2018ri formatda qaytdi`,
    );
  }

  return parsed;
};

const normalizePaymentInterval = (interval: VerifixPaymentInterval) => ({
  inputId:
    interval.input_id === null || interval.input_id === undefined
      ? null
      : String(interval.input_id),
  inputLocationId:
    interval.input_location_id === null ||
    interval.input_location_id === undefined
      ? null
      : String(interval.input_location_id),
  inputLocationName: interval.input_location_name ?? null,
  inputTime: interval.input_time ?? null,
  outputId:
    interval.output_id === null || interval.output_id === undefined
      ? null
      : String(interval.output_id),
  outputLocationId:
    interval.output_location_id === null ||
    interval.output_location_id === undefined
      ? null
      : String(interval.output_location_id),
  outputLocationName: interval.output_location_name ?? null,
  outputTime: interval.output_time ?? null,
  turnoutTimeSeconds: parseVerifixAmount(
    interval.turnout_time,
    'turnout_time',
  ),
  wageAmount: parseVerifixAmount(interval.wage_amount, 'wage_amount'),
  overtimeTimeSeconds: parseVerifixAmount(
    interval.overtime_time,
    'overtime_time',
  ),
  overtimeAmount: parseVerifixAmount(
    interval.overtime_amount,
    'overtime_amount',
  ),
});

const normalizePaymentDay = (day: VerifixPaymentDay) => ({
  date: parseVerifixDate(day.date),
  jobId:
    day.job_id === null || day.job_id === undefined
      ? null
      : String(day.job_id),
  planTimeSeconds: parseVerifixAmount(
    day.plan_time_seconds,
    'plan_time_seconds',
  ),
  dayKind: day.day_kind ?? null,
  dayKindName: day.day_kind_name ?? null,
  wage: parseVerifixAmount(day.wage, 'wage'),
  intervals: (day.intervals ?? []).map(normalizePaymentInterval),
});

const normalizePhone = (value?: string | null) => {
  if (!value) return null;

  const digits = value.replace(/\D/g, '');
  return digits ? `+${digits}` : null;
};

const cleanText = (value?: string | null) => value?.trim() || null;

const getVerifixErrorDetails = (error: unknown) => {
  if (!(error instanceof HttpException)) return null;

  const response = error.getResponse();

  if (typeof response !== 'object' || response === null) return null;

  const details = (response as { details?: unknown }).details;
  return typeof details === 'string' ? details : null;
};

const isDuplicateVerifixPersonError = (error: unknown) => {
  const details = getVerifixErrorDetails(error);

  return Boolean(
    details &&
    /(?:already exists|already been taken|уже существует)/i.test(details) &&
    /phone/i.test(details),
  );
};

const toUserDate = (value?: string | null) => {
  if (!value) return null;

  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
};

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<Employee>,
    private readonly usersService: UsersService,
    private readonly verifixService: VerifixService,
    private readonly companiesService: CompaniesService,
  ) {}

  async create(dto: CreateEmployeeDto, companyId: string) {
    if (dto.userId) {
      await this.usersService.getUserByIdForCompany(dto.userId, companyId);

      const linkedEmployee = await this.employeeModel.findOne({
        companyId,
        userId: dto.userId,
      });

      if (linkedEmployee) {
        throw new ConflictException('Bu user boshqa xodim bilan bog‘langan');
      }

      const phone = normalizePhone(dto.phone);
      const importedEmployee = phone
        ? await this.employeeModel.findOne({
            companyId,
            userId: null,
            phone,
            verifixEmployeeId: { $type: 'string' },
          })
        : null;

      if (importedEmployee) {
        await this.employeeModel.findOneAndUpdate(
          {
            id: importedEmployee.id,
            companyId,
            userId: null,
          },
          {
            $set: {
              userId: dto.userId,
              syncStatus: EmployeeSyncStatus.SYNCED,
              syncError: null,
            },
          },
          { new: true },
        );

        return this.getDetails(importedEmployee.id, companyId);
      }
    }

    const employee = await this.employeeModel.create({
      userId: dto.userId ?? null,
      firstName: dto.firstName,
      lastName: dto.lastName,
      middleName: dto.middleName ?? null,
      gender: dto.gender,
      phone: dto.phone ?? null,
      birthDate: dto.birthDate ?? null,
      jobId: dto.jobId ?? null,
      divisionId: dto.divisionId ?? null,
      locationIds: dto.locationIds ?? [],
      companyId,
      source: EmployeeSource.CRM,
      syncStatus: EmployeeSyncStatus.PENDING,
      syncError: null,
      lastSyncedAt: null,
    });

    try {
      return await this.syncToVerifix(employee.id, companyId);
    } catch {
      return this.getById(employee.id, companyId);
    }
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async getPaginatedEmployees(
    dto: EmployeeListQueryDto,
    companyId?: string,
  ) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = dto.search?.trim();

    const pipeline: PipelineStage[] = [];
    if (companyId) {
      pipeline.push({
        $match: {
          companyId,
        },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'users',
          let: {
            linkedUserId: '$userId',
            employeeCompanyId: '$companyId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: ['$id', '$$linkedUserId'],
                    },
                    {
                      $eq: ['$companyId', '$$employeeCompanyId'],
                    },
                  ],
                },
              },
            },
            {
              $project: {
                password: 0,
                refreshToken: 0,
              },
            },
          ],
          as: 'linkedUsers',
        },
      },
      {
        $set: {
          user: { $arrayElemAt: ['$linkedUsers', 0] },
        },
      },
      {
        $unset: 'linkedUsers',
      },
    );

    if (search) {
      const searchRegex = new RegExp(this.escapeRegex(search), 'i');

      pipeline.push({
        $match: {
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { middleName: searchRegex },
            { phone: searchRegex },
            { verifixEmployeeId: searchRegex },
            { 'user.login': searchRegex },
            { 'user.name': searchRegex },
            { 'user.middleName': searchRegex },
          ],
        },
      });
    }

    pipeline.push({
      $facet: {
        items: [
          {
            $sort: {
              createdAt: -1,
              id: 1,
            },
          },
          {
            $skip: skip,
          },
          {
            $limit: limit,
          },
        ],
        total: [
          {
            $count: 'count',
          },
        ],
      },
    });

    const [result] = await this.employeeModel.aggregate<{
      items: Employee[];
      total: Array<{ count: number }>;
    }>(pipeline);

    const total = result?.total[0]?.count ?? 0;

    return {
      items: result?.items ?? [],
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  getAll(companyId: string, dto: EmployeeListQueryDto) {
    return this.getPaginatedEmployees(dto, companyId);
  }

  getAllForSystem(dto: EmployeeListQueryDto) {
    return this.getPaginatedEmployees(dto);
  }

  async importFromVerifix(companyId: string) {
    const [verifixEmployees, users, existingEmployees] = await Promise.all([
      this.verifixService.listAllEmployees(),
      this.usersService.getAllUsers(companyId),
      this.employeeModel
        .find({ companyId })
        .select('userId verifixEmployeeId')
        .lean()
        .exec(),
    ]);

    const userIdByPhone = new Map<string, string | null>();

    for (const user of users) {
      const phone = normalizePhone(user.phone);
      if (!phone) continue;

      if (userIdByPhone.has(phone)) {
        userIdByPhone.set(phone, null);
      } else {
        userIdByPhone.set(phone, user.id);
      }
    }

    const existingByVerifixId = new Map(
      existingEmployees
        .filter((employee) => employee.verifixEmployeeId)
        .map((employee) => [employee.verifixEmployeeId as string, employee]),
    );
    const reservedUserIds = new Set(
      existingEmployees
        .map((employee) => employee.userId)
        .filter((userId): userId is string => Boolean(userId)),
    );

    const operations: Parameters<typeof this.employeeModel.bulkWrite>[0] = [];
    let skipped = 0;
    let linkedToUsers = 0;
    const importedAt = new Date();

    for (const employee of verifixEmployees) {
      const mapped = this.mapImportedEmployee(employee);

      if (!mapped) {
        skipped += 1;
        continue;
      }

      const existing = existingByVerifixId.get(mapped.verifixEmployeeId);
      const matchedUserId = mapped.phone
        ? userIdByPhone.get(mapped.phone)
        : null;
      const userId =
        existing?.userId ??
        (matchedUserId && !reservedUserIds.has(matchedUserId)
          ? matchedUserId
          : null);

      if (!existing?.userId && userId) {
        reservedUserIds.add(userId);
        linkedToUsers += 1;
      }

      operations.push({
        updateOne: {
          filter: {
            companyId,
            verifixEmployeeId: mapped.verifixEmployeeId,
          },
          update: {
            $set: {
              firstName: mapped.firstName,
              lastName: mapped.lastName,
              middleName: mapped.middleName,
              gender: mapped.gender,
              phone: mapped.phone,
              birthDate: mapped.birthDate,
              jobId: mapped.jobId,
              divisionId: mapped.divisionId,
              syncStatus: EmployeeSyncStatus.SYNCED,
              syncError: null,
              lastSyncedAt: importedAt,
              ...(userId ? { userId } : {}),
            },
            $setOnInsert: {
              companyId,
              verifixEmployeeId: mapped.verifixEmployeeId,
              source: EmployeeSource.VERIFIX,
              locationIds: [],
            },
          },
          upsert: true,
        },
      });
    }

    if (operations.length === 0) {
      return {
        received: verifixEmployees.length,
        created: 0,
        updated: 0,
        linkedToUsers: 0,
        skipped,
      };
    }

    const result = await this.employeeModel.bulkWrite(operations, {
      ordered: false,
    });

    return {
      received: verifixEmployees.length,
      created: result.upsertedCount,
      updated: result.matchedCount,
      linkedToUsers,
      skipped,
    };
  }

  private mapImportedEmployee(employee: VerifixEmployee) {
    const verifixEmployeeId = String(employee.employee_id ?? '').trim();
    const firstName = cleanText(employee.first_name);

    if (
      !verifixEmployeeId ||
      !firstName ||
      !['M', 'F'].includes(employee.gender)
    ) {
      return null;
    }

    return {
      verifixEmployeeId,
      firstName,
      lastName:
        cleanText(employee.last_name) ?? cleanText(employee.middle_name) ?? '—',
      middleName: cleanText(employee.middle_name),
      gender: employee.gender,
      phone: normalizePhone(employee.phone_number),
      birthDate: cleanText(employee.birthday),
      jobId:
        employee.job_id === null || employee.job_id === undefined
          ? null
          : String(employee.job_id),
      divisionId:
        employee.division_id === null || employee.division_id === undefined
          ? null
          : String(employee.division_id),
    };
  }

  async getById(id: string, companyId: string) {
    const employee = await this.employeeModel.findOne({
      id,
      companyId,
    });

    if (!employee) {
      throw new NotFoundException('Xodim topilmadi');
    }

    return employee;
  }

  async getDetails(id: string, companyId: string) {
    const [employee] = await this.employeeModel.aggregate([
      {
        $match: {
          id,
          companyId,
        },
      },
      {
        $lookup: {
          from: 'users',
          let: {
            linkedUserId: '$userId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$id', '$$linkedUserId'] },
                    { $eq: ['$companyId', companyId] },
                  ],
                },
              },
            },
            {
              $project: {
                password: 0,
                refreshToken: 0,
              },
            },
          ],
          as: 'linkedUsers',
        },
      },
      {
        $set: {
          user: { $arrayElemAt: ['$linkedUsers', 0] },
        },
      },
      {
        $unset: 'linkedUsers',
      },
    ]);

    if (!employee) {
      throw new NotFoundException('Xodim topilmadi');
    }

    return employee;
  }

  async getAttendance(
    id: string,
    companyId: string,
    query: EmployeeAttendanceQueryDto,
  ) {
    if (query.from > query.to) {
      throw new BadRequestException(
        'Davomat davrida from sanasi to sanasidan keyin bo\u2018lishi mumkin emas',
      );
    }

    const fromDate = new Date(`${query.from}T00:00:00Z`);
    const toDate = new Date(`${query.to}T00:00:00Z`);
    const periodInDays =
      Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;

    if (periodInDays > 366) {
      throw new BadRequestException(
        'Davomat davri 366 kundan oshmasligi kerak',
      );
    }

    const employee = await this.getById(id, companyId);

    if (!employee.verifixEmployeeId) {
      throw new BadRequestException(
        'Xodim Verifix bilan bog\u2018lanmagan',
      );
    }

    const tracks = await this.verifixService.listEmployeeTracks(
      String(employee.verifixEmployeeId),
      toVerifixDateTime(query.from),
      toVerifixDateTime(query.to, true),
    );

    const tracksByDate = new Map<
      string,
      Array<{ track: VerifixTrack; iso: string }>
    >();

    for (const track of tracks) {
      const parsed = parseVerifixTrackDateTime(track.track_datetime);
      const dayTracks = tracksByDate.get(parsed.date) ?? [];
      dayTracks.push({ track, iso: parsed.iso });
      tracksByDate.set(parsed.date, dayTracks);
    }

    const items = [...tracksByDate.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([date, dayTracks]) => {
        const sortedTracks = dayTracks.sort((left, right) =>
          left.iso.localeCompare(right.iso),
        );
        const checkIn = sortedTracks.find(
          ({ track }) => track.track_type === 'I',
        );
        const checkOut = sortedTracks.findLast(
          ({ track }) => track.track_type === 'O',
        );

        return {
          date,
          checkInAt: checkIn?.iso ?? null,
          checkOutAt: checkOut?.iso ?? null,
          trackCount: sortedTracks.length,
        };
      });

    return {
      period: {
        from: query.from,
        to: query.to,
      },
      summary: {
        recordedDays: items.length,
        daysWithCheckIn: items.filter((item) => item.checkInAt).length,
        totalTrackEvents: tracks.length,
      },
      items,
    };
  }

  async getSalary(
    id: string,
    companyId: string,
    query: EmployeeSalaryQueryDto,
  ) {
    if (query.from > query.to) {
      throw new BadRequestException(
        'Ish haqi davrida from sanasi to sanasidan keyin bo\u2018lishi mumkin emas',
      );
    }

    const fromDate = new Date(`${query.from}T00:00:00Z`);
    const toDate = new Date(`${query.to}T00:00:00Z`);
    const periodInDays =
      Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;

    if (periodInDays > 31) {
      throw new BadRequestException(
        'Verifix ish haqi davri 31 kundan oshmasligi kerak',
      );
    }

    const employee = await this.getById(id, companyId);

    if (!employee.verifixEmployeeId) {
      throw new BadRequestException(
        'Xodim Verifix bilan bog\u2018lanmagan',
      );
    }

    const response = await this.verifixService.getEmployeePaymentsByTime(
      String(employee.verifixEmployeeId),
      toVerifixDate(query.from),
      toVerifixDate(query.to),
    );

    if (!response || !Array.isArray(response.employees)) {
      throw new BadGatewayException(
        'Verifix ish haqi ma\u2018lumotlari noto\u2018g\u2018ri formatda qaytdi',
      );
    }

    const paymentEmployee = response.employees.find(
      (item) => String(item.employee_id) === String(employee.verifixEmployeeId),
    );
    const days = (paymentEmployee?.days ?? [])
      .map(normalizePaymentDay)
      .sort((left, right) => right.date.localeCompare(left.date));
    const intervals = days.flatMap((day) => day.intervals);

    return {
      period: {
        from: query.from,
        to: query.to,
      },
      staffId:
        paymentEmployee?.staff_id === null ||
        paymentEmployee?.staff_id === undefined
          ? null
          : String(paymentEmployee.staff_id),
      summary: {
        totalWage: days.reduce((sum, day) => sum + day.wage, 0),
        plannedTimeSeconds: days.reduce(
          (sum, day) => sum + day.planTimeSeconds,
          0,
        ),
        turnoutTimeSeconds: intervals.reduce(
          (sum, interval) => sum + interval.turnoutTimeSeconds,
          0,
        ),
        overtimeTimeSeconds: intervals.reduce(
          (sum, interval) => sum + interval.overtimeTimeSeconds,
          0,
        ),
        overtimeAmount: intervals.reduce(
          (sum, interval) => sum + interval.overtimeAmount,
          0,
        ),
        workedDays: days.filter((day) => day.intervals.length > 0).length,
      },
      days,
    };
  }

  async update(id: string, dto: UpdateEmployeeDto, companyId: string) {
    const employee = await this.getById(id, companyId);

    if (dto.roleId && !employee.userId) {
      throw new BadRequestException(
        'Rol biriktirish uchun xodimda CRM akkaunti bo‘lishi kerak',
      );
    }
    const nextEmployee = {
      firstName: dto.firstName?.trim() ?? employee.firstName,
      lastName: dto.lastName?.trim() ?? employee.lastName,
      middleName:
        dto.middleName === undefined
          ? employee.middleName
          : cleanText(dto.middleName),
      gender: dto.gender ?? employee.gender,
      phone:
        dto.phone === undefined ? employee.phone : normalizePhone(dto.phone),
      birthDate:
        dto.birthDate === undefined
          ? employee.birthDate
          : cleanText(dto.birthDate),
      jobId: dto.jobId === undefined ? employee.jobId : cleanText(dto.jobId),
      divisionId:
        dto.divisionId === undefined
          ? employee.divisionId
          : cleanText(dto.divisionId),
      locationIds: dto.locationIds ?? employee.locationIds,
    };

    if (employee.verifixEmployeeId) {
      await this.verifixService.updateEmployee({
        employeeId: employee.verifixEmployeeId,
        firstName: nextEmployee.firstName,
        lastName: nextEmployee.lastName,
        middleName: nextEmployee.middleName,
        gender: nextEmployee.gender,
        phone: nextEmployee.phone,
        birthDate: nextEmployee.birthDate,
      });
    }

    await this.employeeModel.findOneAndUpdate(
      { id, companyId },
      {
        $set: {
          ...nextEmployee,
          ...(employee.verifixEmployeeId
            ? {
                syncStatus: EmployeeSyncStatus.SYNCED,
                syncError: null,
                lastSyncedAt: new Date(),
              }
            : {}),
        },
      },
      { new: true, runValidators: true },
    );

    if (employee.userId) {
      await this.usersService.updateEmployeeProfile(
        employee.userId,
        companyId,
        {
          name: nextEmployee.firstName,
          middleName: nextEmployee.lastName,
          phone: nextEmployee.phone,
          date: toUserDate(nextEmployee.birthDate),
          roleId: dto.roleId,
        },
      );
    }

    return this.getDetails(id, companyId);
  }

  async moveToCompany(
    id: string,
    sourceCompanyId: string,
    targetCompanyId: string,
  ) {
    if (sourceCompanyId === targetCompanyId) {
      return this.getDetails(id, sourceCompanyId);
    }

    const [employee, targetCompany] = await Promise.all([
      this.getById(id, sourceCompanyId),
      this.companiesService.findActiveCompanyById(targetCompanyId),
    ]);

    if (!targetCompany) {
      throw new NotFoundException('Ko‘chiriladigan kompaniya topilmadi');
    }

    const duplicateConditions: Record<string, string>[] = [];

    if (employee.verifixEmployeeId) {
      duplicateConditions.push({
        verifixEmployeeId: employee.verifixEmployeeId,
      });
    }

    if (employee.userId) {
      duplicateConditions.push({ userId: employee.userId });
    }

    if (duplicateConditions.length > 0) {
      const duplicate = await this.employeeModel.findOne({
        companyId: targetCompanyId,
        $or: duplicateConditions,
      });

      if (duplicate) {
        throw new ConflictException(
          'Bu xodim tanlangan kompaniyada allaqachon mavjud',
        );
      }
    }

    const session = await this.employeeModel.db.startSession();

    try {
      await session.withTransaction(async () => {
        const movedEmployee = await this.employeeModel.findOneAndUpdate(
          { id, companyId: sourceCompanyId },
          { $set: { companyId: targetCompanyId } },
          { new: true, runValidators: true, session },
        );

        if (!movedEmployee) {
          throw new NotFoundException('Xodim topilmadi');
        }

        if (employee.userId) {
          await this.usersService.moveUserToCompany(
            employee.userId,
            sourceCompanyId,
            targetCompanyId,
            session,
          );
        }
      });
    } finally {
      await session.endSession();
    }

    return this.getDetails(id, targetCompanyId);
  }

  async syncToVerifix(id: string, companyId: string) {
    const employee = await this.employeeModel.findOneAndUpdate(
      {
        id,
        companyId,
        verifixEmployeeId: null,
        syncStatus: {
          $in: [EmployeeSyncStatus.PENDING, EmployeeSyncStatus.FAILED],
        },
      },
      {
        $set: {
          syncStatus: EmployeeSyncStatus.SYNCING,
          syncError: null,
        },
      },
      {
        new: true,
      },
    );

    if (!employee) {
      const existingEmployee = await this.employeeModel.findOne({
        id,
        companyId,
      });

      if (!existingEmployee) {
        throw new NotFoundException('Xodim topilmadi');
      }

      if (existingEmployee.verifixEmployeeId) {
        throw new ConflictException(
          'Xodim Verifix bilan allaqachon sinxronlangan',
        );
      }

      throw new ConflictException('Xodim ayni paytda sinxronlanmoqda');
    }

    try {
      const result = await this.verifixService.createEmployee({
        firstName: employee.firstName,
        lastName: employee.lastName,
        middleName: employee.middleName,
        gender: employee.gender,
        phone: employee.phone,
        birthDate: employee.birthDate,
      });

      return await this.employeeModel.findOneAndUpdate(
        {
          id: employee.id,
          companyId,
        },
        {
          $set: {
            verifixEmployeeId: String(result.employee_id),
            syncStatus: EmployeeSyncStatus.SYNCED,
            syncError: null,
            lastSyncedAt: new Date(),
          },
        },
        {
          new: true,
        },
      );
    } catch (error) {
      if (isDuplicateVerifixPersonError(error) && employee.phone) {
        const phone = normalizePhone(employee.phone);
        let verifixEmployees: VerifixEmployee[] = [];

        try {
          verifixEmployees = await this.verifixService.listAllEmployees();
        } catch {
          // Preserve the original duplicate error below when reconciliation
          // cannot read the current Verifix employee list.
        }

        const matchingEmployees = verifixEmployees.filter(
          (verifixEmployee) =>
            normalizePhone(verifixEmployee.phone_number) === phone &&
            (!verifixEmployee.state || verifixEmployee.state === 'A'),
        );

        if (matchingEmployees.length === 1) {
          return this.employeeModel.findOneAndUpdate(
            {
              id: employee.id,
              companyId,
            },
            {
              $set: {
                verifixEmployeeId: String(matchingEmployees[0].employee_id),
                syncStatus: EmployeeSyncStatus.SYNCED,
                syncError: null,
                lastSyncedAt: new Date(),
              },
            },
            {
              new: true,
            },
          );
        }
      }

      const message =
        getVerifixErrorDetails(error) ??
        (error instanceof Error ? error.message : 'Verifix sync xatosi');

      await this.employeeModel.updateOne(
        {
          id: employee.id,
          companyId,
        },
        {
          $set: {
            syncStatus: EmployeeSyncStatus.FAILED,
            syncError: message,
          },
        },
      );

      throw error;
    }
  }
}

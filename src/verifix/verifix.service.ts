import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerifixListDto } from './dto/verifix-list.dto.js';
import {
  CreateVerifixEmployee,
  CreateVerifixEmployeeResponse,
  VerifixEmployee,
  VerifixEmployeeListResponse,
  UpdateVerifixEmployee,
} from './types/verifix-employee.type.js';
import {
  VerifixTrack,
  VerifixTrackListResponse,
} from './types/verifix-track.type.js';
import { VerifixPaymentsByTimeResponse } from './types/verifix-payment.type.js';

interface VerifixTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface VerifixRequestOptions {
  cursor?: string;
  limit?: number;
  timeoutMs?: number;
}

type VerifixScope = 'read' | 'write';

interface CachedVerifixToken {
  value: string;
  expiresAt: number;
}

@Injectable()
export class VerifixService {
  private readonly baseUrl: string;

  private readonly tokens = new Map<VerifixScope, CachedVerifixToken>();

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService
      .get<string>('VERIFIX_BASE_URL', 'https://app.verifix.com')
      .replace(/\/+$/, '');
  }

  // Barcha xodimlar royxatini olib keladi DTO ga bogliq
  listEmployees(dto: VerifixListDto) {
    return this.request<VerifixEmployeeListResponse>(
      '/b/vhr/api/v1/core/employee$list',
      dto.filters ?? {},
      dto,
    );
  }

  async listAllEmployees(): Promise<VerifixEmployee[]> {
    const employees: VerifixEmployee[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;

    for (let page = 0; page < 1_000; page += 1) {
      const response = await this.listEmployees({
        cursor,
        limit: 500,
        filters: {},
      });

      if (!response || !Array.isArray(response.data)) {
        throw new BadGatewayException(
          'Verifix xodimlar ro‘yxati noto‘g‘ri formatda qaytdi',
        );
      }

      employees.push(...response.data);

      const nextCursor = String(response.meta?.next_cursor ?? '').trim();

      if (
        response.data.length === 0 ||
        !nextCursor ||
        nextCursor === '-1' ||
        seenCursors.has(nextCursor)
      ) {
        return employees;
      }

      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }

    throw new BadGatewayException(
      'Verifix pagination chegarasidan oshib ketdi',
    );
  }

  // Xodimlarni kelish ketishi
  listTracks(dto: VerifixListDto) {
    return this.request<VerifixTrackListResponse>(
      '/b/vhr/api/v1/core/track$list',
      dto.filters ?? {},
      dto,
    );
  }

  async listEmployeeTracks(
    employeeId: string,
    beginDateTime: string,
    endDateTime: string,
  ): Promise<VerifixTrack[]> {
    const tracks: VerifixTrack[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;

    for (let page = 0; page < 1_000; page += 1) {
      const response = await this.listTracks({
        cursor,
        limit: 500,
        filters: {
          employee_ids: [employeeId],
          begin_datetime: beginDateTime,
          end_datetime: endDateTime,
        },
      });

      if (!response || !Array.isArray(response.data)) {
        throw new BadGatewayException(
          'Verifix davomat ma\u2018lumotlari noto\u2018g\u2018ri formatda qaytdi',
        );
      }

      tracks.push(...response.data);

      const nextCursor = String(response.meta?.next_cursor ?? '').trim();

      if (
        response.data.length === 0 ||
        !nextCursor ||
        nextCursor === '-1' ||
        seenCursors.has(nextCursor)
      ) {
        return tracks;
      }

      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }

    throw new BadGatewayException(
      'Verifix davomat pagination chegarasidan oshib ketdi',
    );
  }

  getEmployeePaymentsByTime(
    employeeId: string,
    beginDate: string,
    endDate: string,
  ) {
    return this.request<VerifixPaymentsByTimeResponse>(
      '/b/vhr/api/v1/rep/payments_by_time$list',
      {
        begin_date: beginDate,
        end_date: endDate,
        employee_ids: [employeeId],
      },
      { timeoutMs: 90_000 },
    );
  }

  // Companiyaning locatsiyasi.
  listLocations(dto: VerifixListDto) {
    return this.request(
      '/b/vhr/api/v1/core/location$list',
      dto.filters ?? {},
      dto,
    );
  }

  // xodimlanrning lavozimlar royxati
  listJobs(dto: VerifixListDto) {
    return this.request('/b/vhr/api/v1/core/job$list', dto.filters ?? {}, dto);
  }

  // Bo'limlar royxati
  listDivisions(dto: VerifixListDto) {
    return this.request(
      '/b/vhr/api/v1/core/division$list',
      dto.filters ?? {},
      dto,
    );
  }

  createEmployee(employee: CreateVerifixEmployee) {
    return this.request<CreateVerifixEmployeeResponse>(
      '/b/vhr/api/v1/core/employee$create',
      {
        first_name: employee.firstName,
        last_name: employee.lastName ?? null,
        middle_name: employee.middleName ?? null,
        gender: employee.gender,
        phone_number: employee.phone ?? null,
        birthday: employee.birthDate ?? null,
        state: 'A',
      },
      {},
      'write',
    );
  }

  updateEmployee(employee: UpdateVerifixEmployee) {
    return this.request<void>(
      '/b/vhr/api/v1/core/employee$update',
      {
        employee_id: employee.employeeId,
        first_name: employee.firstName,
        last_name: employee.lastName ?? null,
        middle_name: employee.middleName ?? null,
        gender: employee.gender,
        phone_number: employee.phone ?? null,
        birthday: employee.birthDate ?? null,
      },
      {},
      'write',
    );
  }

  private async getAccessToken(scope: VerifixScope): Promise<string> {
    const cachedToken = this.tokens.get(scope);

    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
      return cachedToken.value;
    }

    const clientId = this.configService.getOrThrow<string>('VERIFIX_CLIENT_ID');

    const clientSecret = this.configService.getOrThrow<string>(
      'VERIFIX_CLIENT_SECRET',
    );

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/security/oauth/token`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Verifix serveriga ulanib bo‘lmadi',
      );
    }

    if (!response.ok) {
      const details = await response.text();

      throw new BadGatewayException({
        message: 'Verifix autentifikatsiyasida xato',
        upstreamStatus: response.status,
        details,
      });
    }

    const result = (await response.json()) as VerifixTokenResponse;

    this.tokens.set(scope, {
      value: result.access_token,
      expiresAt: Date.now() + result.expires_in * 1000,
    });

    return result.access_token;
  }

  private async request<T>(
    path: string,
    body: Record<string, unknown>,
    options: VerifixRequestOptions = {},
    scope: VerifixScope = 'read',
    retry = true,
  ): Promise<T> {
    const token = await this.getAccessToken(scope);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      project_code: this.configService.get<string>(
        'VERIFIX_PROJECT_CODE',
        'vhr',
      ),
    };

    if (options.limit !== undefined) {
      headers.limit = String(options.limit);
    }

    if (options.cursor) {
      headers.cursor = options.cursor;
    }

    const filialId = this.configService.get<string>('VERIFIX_FILIAL_ID');

    if (filialId) {
      headers.filial_id = filialId;
    }

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Verifix serveriga ulanib bo‘lmadi',
      );
    }

    if (response.status === 401 && retry) {
      this.tokens.delete(scope);

      return this.request<T>(path, body, options, scope, false);
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new BadGatewayException({
        message: 'Verifix API xatosi',
        upstreamStatus: response.status,
        details: responseText,
      });
    }

    if (!responseText) {
      return undefined as T;
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      return responseText as T;
    }
  }
}

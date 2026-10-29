export interface CreateVerifixEmployee {
  firstName: string;
  lastName?: string | null;
  middleName?: string | null;
  gender: 'M' | 'F';
  phone?: string | null;
  birthDate?: string | null;
}

export interface CreateVerifixEmployeeResponse {
  employee_id: string | number;
}

export interface UpdateVerifixEmployee extends CreateVerifixEmployee {
  employeeId: string;
}

export interface VerifixEmployee {
  employee_id: string | number;
  first_name: string;
  last_name?: string | null;
  middle_name?: string | null;
  phone_number?: string | null;
  birthday?: string | null;
  gender: 'M' | 'F';
  state?: string | null;
  job_id?: string | number | null;
  division_id?: string | number | null;
}

export interface VerifixEmployeeListResponse {
  data: VerifixEmployee[];
  meta: {
    count: string | number;
    next_cursor?: string | number | null;
  };
}

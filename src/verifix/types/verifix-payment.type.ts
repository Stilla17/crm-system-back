export interface VerifixPaymentInterval {
  input_id?: string | number | null;
  input_location_id?: string | number | null;
  input_location_name?: string | null;
  input_time?: string | null;
  output_id?: string | number | null;
  output_location_id?: string | number | null;
  output_location_name?: string | null;
  output_time?: string | null;
  turnout_time?: string | number | null;
  wage_amount?: string | number | null;
  overtime_time?: string | number | null;
  overtime_amount?: string | number | null;
}

export interface VerifixPaymentDay {
  job_id?: string | number | null;
  date: string;
  plan_time_seconds?: string | number | null;
  day_kind?: string | null;
  day_kind_name?: string | null;
  wage?: string | number | null;
  intervals?: VerifixPaymentInterval[] | null;
}

export interface VerifixPaymentEmployee {
  staff_id?: string | number | null;
  employee_id: string | number;
  employee_name?: string | null;
  days?: VerifixPaymentDay[] | null;
}

export interface VerifixPaymentsByTimeResponse {
  employees: VerifixPaymentEmployee[];
}

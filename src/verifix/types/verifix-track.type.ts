export interface VerifixTrack {
  track_id: string | number;
  schedule_id?: string | number | null;
  employee_id: string | number;
  staff_id?: string | number | null;
  division_id?: string | number | null;
  location_id?: string | number | null;
  track_type: string;
  mark_type?: string | null;
  track_datetime: string;
}

export interface VerifixTrackListResponse {
  data: VerifixTrack[];
  meta: {
    count: string | number;
    next_cursor?: string | number | null;
  };
}

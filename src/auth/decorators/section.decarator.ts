import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SECTION_KEY = 'required-section';

export const RequireSection = (section: string) =>
  SetMetadata(REQUIRED_SECTION_KEY, section);
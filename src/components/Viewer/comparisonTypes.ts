import type { Study } from '@/types/radiology';

export interface PriorStudy {
  study: Study;
  label: string;
  date: string;
}

import { apiClient } from './apiClient';

export interface DriftWindow {
  start: string;
  end: string;
}

export interface InferenceSummary {
  count: number;
  success_count: number;
  failure_count: number;
  failure_rate: number | null;
  confidence_avg: number | null;
  confidence_median: number | null;
  confidence_min: number | null;
  confidence_max: number | null;
  latency_avg_ms: number | null;
}

export interface QASummary {
  count: number;
  pass_count: number;
  warn_count: number;
  fail_count: number;
  pass_rate: number | null;
  quality_score_avg: number | null;
}

export interface DriftDelta {
  confidence_avg?: number | null;
  confidence_median?: number | null;
  failure_rate?: number | null;
  pass_rate?: number | null;
  quality_score_avg?: number | null;
}

export interface DriftAlert {
  metric: string;
  delta: number;
  threshold: number;
}

export interface DriftReport {
  window_days: number;
  baseline_days: number;
  window: DriftWindow;
  baseline_window: DriftWindow;
  current: { inference: InferenceSummary; qa: QASummary };
  baseline: { inference: InferenceSummary; qa: QASummary };
  delta: { inference: DriftDelta; qa: DriftDelta };
  alerts: DriftAlert[];
}

export interface DriftSnapshot {
  id: string;
  created_at: string;
  window_days: number;
  baseline_days: number;
  payload: DriftReport;
}

export const monitoringClient = {
  async getDriftReport(windowDays = 7, baselineDays?: number, persist = false): Promise<DriftReport> {
    const params = new URLSearchParams({ window_days: String(windowDays) });
    if (baselineDays) params.set('baseline_days', String(baselineDays));
    if (persist) params.set('persist', 'true');
    return apiClient.get<DriftReport>(`/api/v1/monitoring/drift?${params}`);
  },

  async listDriftSnapshots(limit = 50, offset = 0): Promise<DriftSnapshot[]> {
    return apiClient.get<DriftSnapshot[]>(
      `/api/v1/monitoring/drift/snapshots?limit=${limit}&offset=${offset}`
    );
  },

  async getMetrics() {
    return apiClient.get<Record<string, unknown>>('/api/v1/metrics');
  },
};

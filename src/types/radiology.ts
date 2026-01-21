// MedGemma Radiology Types

export interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: 'M' | 'F' | 'O';
  mrn: string; // Medical Record Number
}

export interface Study {
  id: string;
  patientId: string;
  accessionNumber: string;
  modality: 'CT' | 'MR' | 'CR' | 'DX' | 'US' | 'NM' | 'PT';
  studyDate: string;
  studyDescription: string;
  referringPhysician: string;
  series: Series[];
}

export interface Series {
  id: string;
  studyId: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  frameCount: number;
  thumbnailUrl?: string;
}

export interface Report {
  id: string;
  studyId: string;
  patientId: string;
  status: ReportStatus;
  findingsText: string;
  impressionText: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  qaStatus: QAStatus;
  qaWarnings: string[];
  aiStatus?: AIStatus;
  inferenceStatus?: string;
  inferenceSummary?: string;
  inferenceConfidence?: number;
  inferenceModelVersion?: string;
  inferenceJobId?: string;
  inferenceCompletedAt?: string;
}

export type ReportStatus = 'pending' | 'in_progress' | 'draft' | 'approved' | 'finalized';

export type QAStatus = 'pending' | 'checking' | 'pass' | 'warn' | 'fail';

export type AIStatus = 'idle' | 'queued' | 'processing' | 'error';

export interface ASRResult {
  text: string;
  confidence: number;
  timestamp: string;
}

export interface AIImpressionResult {
  text: string;
  confidence: number;
  model: string;
  generatedAt: string;
}

export interface QACheckResult {
  status: QAStatus;
  checks: QACheck[];
  warnings: string[];
  errors: string[];
}

export interface QACheck {
  id: string;
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  modality: string;
  description: string;
  sections: string[];
  lastUpdated?: string;
}

export interface Guideline {
  id: string;
  title: string;
  category: string;
  summary: string;
  status: 'pass' | 'warn' | 'info' | 'critical';
  source?: string;
}

export interface AuditEvent {
  id?: string;
  eventType: string;
  actorId?: string;
  reportId?: string;
  studyId?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

// Viewer types
export interface ViewerTool {
  id: string;
  name: string;
  icon: string;
  shortcut?: string;
  active?: boolean;
}

export interface WindowLevel {
  windowCenter: number;
  windowWidth: number;
  preset?: string;
}

// Queue types
export interface QueueItem {
  id: string;
  patient: Patient;
  study: Study;
  report: Report;
  priority: 'normal' | 'urgent' | 'stat';
  assignedTo?: string;
}

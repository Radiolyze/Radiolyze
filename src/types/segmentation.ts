export type SegmentationPreset = 'bone' | 'total';

export type SegmentationStatus =
  | 'queued'
  | 'started'
  | 'running'
  | 'finished'
  | 'failed';

export interface SegmentationLabel {
  id: number;
  name: string;
  color: [number, number, number];
  volume_ml: number;
  voxel_count: number;
  vertex_count?: number;
  face_count?: number;
  mask_url: string;
  mesh_url: string;
  vtp_url?: string;
}

export interface SegmentationDicomSeg {
  url: string;
  label_count: number;
  sop_instance_uid: string;
  series_instance_uid: string;
  study_instance_uid: string;
}

export interface SegmentationManifest {
  job_id: string;
  preset: SegmentationPreset;
  source: {
    study_uid: string;
    series_uid: string;
    modality: string;
  };
  volume: {
    spacing: number[];
    origin: number[];
    direction: number[];
    shape: number[];
  };
  labels: SegmentationLabel[];
  created_at?: string;
  warnings?: string[];
  dicom_seg?: SegmentationDicomSeg;
}

export interface SegmentationJobResponse {
  job_id: string;
  status: SegmentationStatus;
  progress: number;
  preset: SegmentationPreset;
  study_uid: string;
  series_uid: string;
  queued_at?: string | null;
  updated_at?: string | null;
  manifest?: SegmentationManifest | null;
  error?: string | null;
  dicom_seg_orthanc_url?: string | null;
}

export interface PushToPacsResponse {
  job_id: string;
  dicom_seg_orthanc_url: string;
  pushed_at: string;
}

export interface SegmentationCreateInput {
  studyUid: string;
  seriesUid: string;
  preset: SegmentationPreset;
  requestedBy?: string;
}

export interface LabelDisplayState {
  visible: boolean;
  opacity: number;
  color: [number, number, number];
}

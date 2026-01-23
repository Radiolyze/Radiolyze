// Annotation types for Fine-Tuning workflow

export type AnnotationToolType = 
  | 'length' 
  | 'rectangle' 
  | 'ellipse' 
  | 'freehand' 
  | 'bidirectional' 
  | 'arrow';

export type AnnotationCategory = 
  | 'nodule' 
  | 'mass' 
  | 'infiltrate' 
  | 'effusion' 
  | 'fracture' 
  | 'lesion' 
  | 'anatomical' 
  | 'other';

export type AnnotationSeverity = 'benign' | 'indeterminate' | 'malignant';

export type AnnotationLaterality = 'left' | 'right' | 'bilateral' | 'midline';

export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TrainingAnnotation {
  id: string;
  studyId: string;
  seriesId: string;
  instanceId: string;
  frameIndex: number;
  
  // Geometry
  toolType: AnnotationToolType;
  handles: Point3D[];
  boundingBox?: BoundingBox;
  
  // Classification
  label: string;
  category: AnnotationCategory;
  severity?: AnnotationSeverity;
  confidence?: number;
  
  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  
  // DICOM context
  anatomicalRegion?: string;
  laterality?: AnnotationLaterality;
  
  // Cornerstone reference
  cornerstoneAnnotationUID?: string;
}

export interface AnnotationCreateRequest {
  studyId: string;
  seriesId: string;
  instanceId: string;
  frameIndex: number;
  toolType: AnnotationToolType;
  handles: Point3D[];
  boundingBox?: BoundingBox;
  label: string;
  category: AnnotationCategory;
  severity?: AnnotationSeverity;
  notes?: string;
  anatomicalRegion?: string;
  laterality?: AnnotationLaterality;
  actorId?: string;
  cornerstoneAnnotationUID?: string;
}

export interface AnnotationUpdateRequest {
  label?: string;
  category?: AnnotationCategory;
  severity?: AnnotationSeverity;
  notes?: string;
  anatomicalRegion?: string;
  laterality?: AnnotationLaterality;
  handles?: Point3D[];
  boundingBox?: BoundingBox;
  actorId?: string;
}

export interface AnnotationVerifyRequest {
  actorId: string;
}

export interface AnnotationListParams {
  studyId?: string;
  seriesId?: string;
  category?: AnnotationCategory;
  verifiedOnly?: boolean;
  limit?: number;
  offset?: number;
}

// Annotation category labels for UI
export const ANNOTATION_CATEGORIES: Record<AnnotationCategory, string> = {
  nodule: 'Nodule',
  mass: 'Masse',
  infiltrate: 'Infiltrat',
  effusion: 'Erguss',
  fracture: 'Fraktur',
  lesion: 'Läsion',
  anatomical: 'Anatomisch',
  other: 'Sonstiges',
};

export const ANNOTATION_SEVERITIES: Record<AnnotationSeverity, string> = {
  benign: 'Benigne',
  indeterminate: 'Unbestimmt',
  malignant: 'Maligne',
};

export const ANNOTATION_LATERALITIES: Record<AnnotationLaterality, string> = {
  left: 'Links',
  right: 'Rechts',
  bilateral: 'Bilateral',
  midline: 'Mittellinie',
};

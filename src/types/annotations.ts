// Annotation types for Fine-Tuning workflow

export type AnnotationToolType =
  "length" | "rectangle" | "ellipse" | "freehand" | "bidirectional" | "arrow";

export type AnnotationCategory =
  "nodule" | "mass" | "infiltrate" | "effusion" | "fracture" | "lesion" | "anatomical" | "other";

export type AnnotationSeverity = "benign" | "indeterminate" | "malignant";

export type AnnotationLaterality = "left" | "right" | "bilateral" | "midline";

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

/**
 * Display order for the UI selects. These carry no labels: a label table in a
 * type module is fixed at import time, so a language switch would leave the
 * text on screen behind. The labels live under `viewer:annotations.categories`,
 * `.severities` and `.lateralities`, resolved at the render site, and a
 * contract test walks each list so a member added without a translation fails
 * the suite instead of rendering a raw key.
 */
export const ANNOTATION_CATEGORY_VALUES: AnnotationCategory[] = [
  "nodule",
  "mass",
  "infiltrate",
  "effusion",
  "fracture",
  "lesion",
  "anatomical",
  "other",
];

export const ANNOTATION_SEVERITY_VALUES: AnnotationSeverity[] = [
  "benign",
  "indeterminate",
  "malignant",
];

export const ANNOTATION_LATERALITY_VALUES: AnnotationLaterality[] = [
  "left",
  "right",
  "bilateral",
  "midline",
];

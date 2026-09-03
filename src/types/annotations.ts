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
 * Keys into the `viewer` namespace, resolved where a category is rendered.
 *
 * Severity and laterality had label tables here too, in German only and read by
 * nothing — the panel that would show them does not exist yet. They are dropped
 * rather than translated, so the vocabulary gets written once, next to whatever
 * ends up rendering it.
 */
export const ANNOTATION_CATEGORY_KEYS: Record<AnnotationCategory, string> = {
  nodule: "annotations.category.nodule",
  mass: "annotations.category.mass",
  infiltrate: "annotations.category.infiltrate",
  effusion: "annotations.category.effusion",
  fracture: "annotations.category.fracture",
  lesion: "annotations.category.lesion",
  anatomical: "annotations.category.anatomical",
  other: "annotations.category.other",
};

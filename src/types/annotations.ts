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
 * i18n keys of the annotation label tables, in the `viewer` namespace.
 *
 * These are data tables, not markup: a `useTranslation` in a type module is the
 * wrong place for it, so each entry holds a key that the render site resolves.
 * Convention: `annotations.<table>.${member}` — `annotationLabels.test.ts` pins
 * that every member of each union has a key and that every key resolves in both
 * languages, so a category added here without translations fails the suite
 * instead of rendering a raw key to the user.
 */
export const ANNOTATION_CATEGORY_KEYS: Record<AnnotationCategory, string> = {
  nodule: "annotations.categories.nodule",
  mass: "annotations.categories.mass",
  infiltrate: "annotations.categories.infiltrate",
  effusion: "annotations.categories.effusion",
  fracture: "annotations.categories.fracture",
  lesion: "annotations.categories.lesion",
  anatomical: "annotations.categories.anatomical",
  other: "annotations.categories.other",
};

export const ANNOTATION_SEVERITY_KEYS: Record<AnnotationSeverity, string> = {
  benign: "annotations.severities.benign",
  indeterminate: "annotations.severities.indeterminate",
  malignant: "annotations.severities.malignant",
};

export const ANNOTATION_LATERALITY_KEYS: Record<AnnotationLaterality, string> = {
  left: "annotations.lateralities.left",
  right: "annotations.lateralities.right",
  bilateral: "annotations.lateralities.bilateral",
  midline: "annotations.lateralities.midline",
};

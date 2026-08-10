import type { AuditEventResponse } from "./auditClient";
import type { StudyLookupEntry } from "@/hooks/useStudyLookup";

/**
 * Audit events as the history timeline shows them.
 *
 * The backend stores an event as an identifier plus a free-form metadata bag, so
 * everything the timeline displays — who acted, which patient, which accession —
 * has to be resolved out of that bag with fallbacks. These helpers are the whole
 * of that resolution and are pure, so the fallback chains can be tested without
 * rendering the page.
 */

export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  actorId?: string;
  actorName: string;
  reportId?: string;
  studyId?: string;
  patientName: string;
  accessionNumber: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type AuditEventType =
  | "report_created"
  | "report_opened"
  | "findings_saved"
  | "impression_generated"
  | "asr_transcription"
  | "qa_check_run"
  | "report_approved"
  | "report_amended"
  | "report_exported"
  | "inference_queued"
  | "other";

/** Event types the timeline renders with their own icon and label. */
export const AUDIT_EVENT_TYPES: readonly AuditEventType[] = [
  "report_created",
  "report_opened",
  "findings_saved",
  "impression_generated",
  "asr_transcription",
  "qa_check_run",
  "report_approved",
  "report_amended",
  "report_exported",
  "inference_queued",
];

const knownEventTypes = new Set<AuditEventType>(AUDIT_EVENT_TYPES);

/** Stands in for a patient name or accession the event carries no value for. */
const UNKNOWN_LABEL = "-";

/** An event type the frontend does not know falls back to the generic bucket. */
export const resolveEventType = (eventType: string): AuditEventType =>
  knownEventTypes.has(eventType as AuditEventType) ? (eventType as AuditEventType) : "other";

const getMetadataRecord = (metadata?: Record<string, unknown> | null) =>
  metadata && typeof metadata === "object" ? metadata : {};

const getMetadataString = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
};

const buildFallbackLabel = (label: string, id?: string | null) =>
  id ? `${label} ${id.slice(0, 8)}...` : "";

export const resolveActorName = (event: AuditEventResponse) => {
  const metadata = getMetadataRecord(event.metadata);
  return (
    getMetadataString(metadata, "actor_name") ||
    getMetadataString(metadata, "signature") ||
    getMetadataString(metadata, "approved_by") ||
    event.actor_id ||
    "System"
  );
};

export const resolvePatientName = (event: AuditEventResponse, unknownLabel = UNKNOWN_LABEL) => {
  const metadata = getMetadataRecord(event.metadata);
  const patientName = getMetadataString(metadata, "patient_name");
  if (patientName) return patientName;

  const studyFallback = buildFallbackLabel("Study", event.study_id);
  if (studyFallback) return studyFallback;

  const reportFallback = buildFallbackLabel("Report", event.report_id);
  if (reportFallback) return reportFallback;

  return unknownLabel;
};

export const resolveAccessionNumber = (event: AuditEventResponse) => {
  const metadata = getMetadataRecord(event.metadata);
  const accession = getMetadataString(metadata, "accession_number");
  if (accession) return accession;
  if (event.study_id) return event.study_id.slice(0, 12);
  if (event.report_id) return event.report_id.slice(0, 12);
  return "—";
};

const isPlaceholderPatientName = (value: string, unknownLabel = UNKNOWN_LABEL) =>
  value === unknownLabel || value.startsWith("Study ") || value.startsWith("Report ");

const isPlaceholderAccession = (value: string, studyId?: string) =>
  value === "—" || (studyId ? value === studyId.slice(0, 12) : false);

export const mapAuditEventToEntry = (event: AuditEventResponse): AuditLogEntry => ({
  id: event.id,
  eventType: resolveEventType(event.event_type),
  actorId: event.actor_id ?? undefined,
  actorName: resolveActorName(event),
  reportId: event.report_id ?? undefined,
  studyId: event.study_id ?? undefined,
  patientName: resolvePatientName(event),
  accessionNumber: resolveAccessionNumber(event),
  timestamp: event.timestamp,
  metadata: event.metadata ?? undefined,
});

export const mapAuditEventsToEntries = (events: AuditEventResponse[]): AuditLogEntry[] =>
  events.map(mapAuditEventToEntry);

/**
 * Fills placeholder patient names and accessions from the DICOM study lookup.
 *
 * Only placeholders are replaced: a value the event itself carried wins over the
 * study, since the metadata records what was true when the event happened.
 */
export const enrichEntriesWithStudyDetails = (
  entries: AuditLogEntry[],
  studyMap: Record<string, StudyLookupEntry>,
): AuditLogEntry[] => {
  if (entries.length === 0) return entries;

  let changed = false;
  const enriched = entries.map((entry) => {
    if (!entry.studyId) return entry;
    const details = studyMap[entry.studyId];
    if (!details) return entry;

    const patientName = isPlaceholderPatientName(entry.patientName)
      ? details.patientName
      : entry.patientName;
    const accessionNumber = isPlaceholderAccession(entry.accessionNumber, entry.studyId)
      ? details.accessionNumber
      : entry.accessionNumber;

    if (patientName === entry.patientName && accessionNumber === entry.accessionNumber) {
      return entry;
    }

    changed = true;
    return { ...entry, patientName, accessionNumber };
  });

  return changed ? enriched : entries;
};

/** Date-group headings, resolved by the caller so this stays free of i18n. */
export interface DateGroupLabels {
  today: string;
  yesterday: string;
  /** Heading for any other day — receives the day the entries fall on. */
  other: (date: Date) => string;
}

/**
 * Groups entries under `Today` / `Yesterday` / a calendar date, insertion-ordered.
 *
 * The caller supplies `now` so a test can pin what "today" means.
 */
export const groupEntriesByDate = (
  entries: AuditLogEntry[],
  labels: DateGroupLabels,
  now: Date = new Date(),
): Map<string, AuditLogEntry[]> => {
  const groups = new Map<string, AuditLogEntry[]>();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  entries.forEach((entry) => {
    const date = new Date(entry.timestamp);

    let key: string;
    if (date.toDateString() === now.toDateString()) {
      key = labels.today;
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = labels.yesterday;
    } else {
      key = labels.other(date);
    }

    const group = groups.get(key);
    if (group) {
      group.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  });

  return groups;
};

/** True when the entry was recorded on the same calendar day as `now`. */
export const isOnSameDay = (timestamp: string, now: Date = new Date()) =>
  new Date(timestamp).toDateString() === now.toDateString();

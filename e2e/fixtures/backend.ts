import type { Page, Route } from "@playwright/test";

/**
 * Shared E2E stubs. The specs run against Vite's dev server with the backend
 * replaced by network mocks rather than a live docker-compose stack, so they
 * stay fast and deterministic without Postgres/Redis/Orthanc/vLLM. Point
 * E2E_BASE_URL at a real stack to exercise the same flows for real.
 */

const PREFERENCES_STORAGE_KEY = "radiolyze-user-preferences";

/**
 * `useUserPreferences` defaults `uiLanguage` to 'de' and applies it once any
 * page mounting that hook loads, overriding i18n's own 'en' default - pin the
 * locale up front so assertions don't depend on navigation order. Stored
 * preferences are merged over the defaults, so only the keys a spec cares
 * about need listing here.
 */
export async function pinPreferences(page: Page, overrides: Record<string, unknown> = {}) {
  const stored = JSON.stringify({ uiLanguage: "en", ...overrides });
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [PREFERENCES_STORAGE_KEY, stored] as const,
  );
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

// --- DICOMweb -------------------------------------------------------------

export interface SeriesFixture {
  seriesUid: string;
  seriesNumber: number;
  description: string;
  modality: string;
  instanceCount: number;
}

export interface StudyFixture {
  studyUid: string;
  patientId: string;
  /** DICOM person name, i.e. "LAST^FIRST". */
  patientName: string;
  patientBirthDate: string;
  patientSex: "M" | "F" | "O";
  /** DICOM date, i.e. "20260115". */
  studyDate: string;
  studyDescription: string;
  accessionNumber: string;
  modality: string;
  referringPhysician: string;
  series: SeriesFixture[];
}

type DicomValue = { Value: unknown[] };

const tag = (value: string | number): DicomValue => ({ Value: [String(value)] });
const personName = (value: string): DicomValue => ({ Value: [{ Alphabetic: value }] });

const studyRecord = (study: StudyFixture) => ({
  "0020000D": tag(study.studyUid),
  "00100020": tag(study.patientId),
  "00100010": personName(study.patientName),
  "00100030": tag(study.patientBirthDate),
  "00100040": tag(study.patientSex),
  "00080020": tag(study.studyDate),
  "00080050": tag(study.accessionNumber),
  "00080061": tag(study.modality),
  "00081030": tag(study.studyDescription),
  "00080090": personName(study.referringPhysician),
});

const seriesRecord = (series: SeriesFixture) => ({
  "0020000E": tag(series.seriesUid),
  "00200011": tag(series.seriesNumber),
  "0008103E": tag(series.description),
  "00080060": tag(series.modality),
  "00201209": tag(series.instanceCount),
});

const instanceRecords = (series: SeriesFixture) =>
  Array.from({ length: series.instanceCount }, (_, index) => ({
    "00080018": tag(`${series.seriesUid}.${index + 1}`),
    "00200013": tag(index + 1),
  }));

/**
 * Serves QIDO-RS study/series/instance queries from the given fixtures.
 * Pixel data (WADO-RS frames, instance metadata) is deliberately left
 * unserved: a headless browser cannot decode it anyway, and the viewer keeps
 * those failures inside its own error boundary, so the report workflow around
 * it stays testable.
 */
export async function mockDicomWeb(page: Page, studies: StudyFixture[]) {
  const seriesPattern = /\/studies\/([^/]+)\/series$/;
  const instancesPattern = /\/studies\/([^/]+)\/series\/([^/]+)\/instances$/;

  await page.route("**/dicom-web/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/dicom-web/, "");

    if (path === "/studies") {
      // The prior-studies lookup filters by patient; there are no priors in
      // these fixtures, so an empty result keeps the comparison view out of
      // the way instead of offering the current study as its own prior.
      if (url.searchParams.get("PatientID")) return json(route, []);
      return json(route, studies.map(studyRecord));
    }

    const instancesMatch = path.match(instancesPattern);
    if (instancesMatch) {
      const series = studies
        .find((study) => study.studyUid === instancesMatch[1])
        ?.series.find((entry) => entry.seriesUid === instancesMatch[2]);
      return json(route, series ? instanceRecords(series) : []);
    }

    const seriesMatch = path.match(seriesPattern);
    if (seriesMatch) {
      const study = studies.find((entry) => entry.studyUid === seriesMatch[1]);
      return json(route, study ? study.series.map(seriesRecord) : []);
    }

    return json(route, { detail: "Not stubbed" }, 404);
  });
}

// --- Backend API ----------------------------------------------------------

export interface QaCheckFixture {
  id: string;
  name: string;
  status: "pass" | "warn" | "fail";
  message?: string;
}

interface ReportPayload {
  id: string;
  study_id: string;
  patient_id: string;
  status: string;
  findings_text: string;
  impression_text: string;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  qa_status: string;
  qa_warnings: string[];
}

export interface ApiOptions {
  /** Studies whose reports the backend should already know about. */
  studies: StudyFixture[];
  /** Summary the stubbed inference job returns. */
  impressionText: string;
  qaChecks: QaCheckFixture[];
  /** Overrides for endpoints a spec wants to control itself. */
  routes?: Record<string, (route: Route) => unknown>;
}

const FIXED_TIMESTAMP = "2026-01-15T09:00:00Z";

export const reportIdForStudy = (studyUid: string) => `report-${studyUid}`;

/**
 * Stubs the report/inference/QA endpoints the reporting workspace calls,
 * keeping reports in memory so a PATCH or finalize is visible to later reads.
 * Every other `/api/` call resolves to an empty 200 so unrelated polling
 * (notifications, guidelines, templates, ...) doesn't fail the run.
 */
export async function mockApi(page: Page, options: ApiOptions) {
  const reports = new Map<string, ReportPayload>(
    options.studies.map((study) => [
      reportIdForStudy(study.studyUid),
      {
        id: reportIdForStudy(study.studyUid),
        study_id: study.studyUid,
        patient_id: study.patientId,
        status: "pending",
        findings_text: "",
        impression_text: "",
        created_at: FIXED_TIMESTAMP,
        updated_at: FIXED_TIMESTAMP,
        qa_status: "pending",
        qa_warnings: [],
      },
    ]),
  );

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    const override = options.routes?.[path];
    if (override) return override(route);

    if (path === "/api/v1/inference/queue") {
      return json(route, { job_id: "e2e-job-1", status: "queued", model_version: "e2e-mock" });
    }

    if (path.startsWith("/api/v1/inference/status/")) {
      return json(route, {
        job_id: path.split("/").pop(),
        status: "finished",
        result: {
          summary: options.impressionText,
          confidence: 0.92,
          model_version: "e2e-mock",
          completed_at: FIXED_TIMESTAMP,
        },
      });
    }

    if (path === "/api/v1/reports/qa-check") {
      return json(route, {
        passes: options.qaChecks.every((check) => check.status === "pass"),
        checks: options.qaChecks,
        warnings: options.qaChecks
          .filter((check) => check.status === "warn")
          .map((check) => check.message ?? check.name),
        failures: options.qaChecks
          .filter((check) => check.status === "fail")
          .map((check) => check.message ?? check.name),
      });
    }

    const finalizeMatch = path.match(/^\/api\/v1\/reports\/(.+)\/finalize$/);
    if (finalizeMatch && method === "POST") {
      const report = reports.get(finalizeMatch[1]);
      if (!report) return json(route, { detail: "Report not found" }, 404);
      const body = (request.postDataJSON() ?? {}) as { signature?: string; approvedBy?: string };
      const finalized: ReportPayload = {
        ...report,
        status: "approved",
        approved_by: body.signature ?? body.approvedBy ?? null,
        approved_at: FIXED_TIMESTAMP,
        updated_at: FIXED_TIMESTAMP,
      };
      reports.set(finalized.id, finalized);
      return json(route, finalized);
    }

    const reportMatch = path.match(/^\/api\/v1\/reports\/([^/]+)$/);
    if (reportMatch) {
      const report = reports.get(reportMatch[1]);
      if (!report) return json(route, { detail: "Report not found" }, 404);

      if (method === "PATCH") {
        const body = (request.postDataJSON() ?? {}) as Record<string, string | undefined>;
        const updated: ReportPayload = {
          ...report,
          findings_text: body.findings_text ?? report.findings_text,
          impression_text: body.impression_text ?? report.impression_text,
          status: body.status ?? report.status,
          updated_at: FIXED_TIMESTAMP,
        };
        reports.set(updated.id, updated);
        return json(route, updated);
      }

      return json(route, report);
    }

    return json(route, {});
  });
}

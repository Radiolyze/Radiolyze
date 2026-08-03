/**
 * Network stubs for the core-workflow E2E specs.
 *
 * Like `auth.spec.ts`, the backend is stubbed at the network layer rather than
 * run as a docker-compose stack, so the suite stays fast and deterministic in
 * CI without Postgres/Redis/Orthanc/vLLM. The stubs speak the same wire format
 * as the real services, so the app's own mapping and polling code runs
 * unmodified. Point `E2E_BASE_URL` at a running stack to exercise the real
 * thing instead.
 */

import type { Page, Route } from "@playwright/test";
import {
  STUDIES,
  buildReport,
  qidoInstanceRecord,
  qidoSeriesRecord,
  qidoStudyRecord,
  reportIdForStudy,
  type ReportPayload,
  type StudyFixture,
} from "./fixtures";

/** Orthanc is a different origin than the app; fulfilled responses need CORS. */
const DICOM_WEB_HEADERS = {
  "access-control-allow-origin": "*",
  "cross-origin-resource-policy": "cross-origin",
};

export interface InferenceOptions {
  /** Text the job returns as its summary — becomes findings and impression. */
  summary: string;
  confidence?: number;
  modelVersion?: string;
  /**
   * Job states served by `/inference/status/{id}`, one per poll. The last entry
   * repeats. `finished` yields the result, `failed` yields `error`.
   */
  statuses?: string[];
  error?: string;
}

export interface QaOptions {
  passes?: boolean;
  warnings?: string[];
  failures?: string[];
}

export interface MockBackendOptions {
  studies?: StudyFixture[];
  /** Per-report-id overrides applied to the default payload. */
  reportOverrides?: Record<string, Partial<ReportPayload>>;
  inference?: InferenceOptions;
  qa?: QaOptions;
}

export interface RecordedCall {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
}

export interface MockBackend {
  /** Live report state — mutated by PATCH and finalize, readable from tests. */
  reports: Map<string, ReportPayload>;
  calls: {
    inferenceQueue: RecordedCall[];
    qaCheck: RecordedCall[];
    finalize: RecordedCall[];
    reportPatch: RecordedCall[];
  };
}

const readBody = (route: Route): Record<string, unknown> | null => {
  const raw = route.request().postData();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

const dicomJson = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/dicom+json",
    headers: DICOM_WEB_HEADERS,
    body: JSON.stringify(body),
  });

/**
 * Pin the UI language before any page script runs. `useUserPreferences`
 * defaults `uiLanguage` to 'de' and applies it on mount, which would otherwise
 * override i18n's own 'en' default depending on navigation order.
 */
export const pinEnglishLocale = (page: Page) =>
  page.addInitScript(() => {
    window.localStorage.setItem("radiolyze-user-preferences", JSON.stringify({ uiLanguage: "en" }));
  });

export async function mockWorkflowBackend(
  page: Page,
  options: MockBackendOptions = {},
): Promise<MockBackend> {
  const studies = options.studies ?? STUDIES;
  const inference: Required<Pick<InferenceOptions, "summary">> & InferenceOptions = {
    summary: "No acute cardiopulmonary abnormality.",
    confidence: 0.91,
    modelVersion: "e2e-mock-1",
    statuses: ["started", "finished"],
    ...options.inference,
  };
  const qa: QaOptions = options.qa ?? { passes: true };

  const reports = new Map<string, ReportPayload>(
    studies.map((study) => {
      const id = reportIdForStudy(study);
      return [id, buildReport(study, options.reportOverrides?.[id])];
    }),
  );

  const calls: MockBackend["calls"] = {
    inferenceQueue: [],
    qaCheck: [],
    finalize: [],
    reportPatch: [],
  };

  const studyByUid = new Map(studies.map((study) => [study.uid, study]));
  const seriesByUid = new Map(
    studies.flatMap((study) => study.series.map((series) => [series.uid, series] as const)),
  );

  /** Poll counter per job id, so a job can report `started` before `finished`. */
  const pollCounts = new Map<string, number>();

  const record = (list: RecordedCall[], route: Route) =>
    list.push({
      url: route.request().url(),
      method: route.request().method(),
      body: readBody(route),
    });

  // --- Fallbacks (registered first: later routes take precedence) -----------

  // Unmocked API calls the workspace pings on mount (templates, prompts,
  // notifications, ...). Lists get `[]` rather than `{}` so components that map
  // over the response don't blow up on an unrelated endpoint.
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => json(route, route.request().method() === "GET" ? [] : {}),
  );

  // WADO-RS pixel data. Nothing decodes real pixels here, and Cornerstone
  // tolerates the failure — the workflow only needs the instance list to build
  // its image references.
  await page.route(
    (url) => url.pathname.startsWith("/dicom-web/"),
    (route) =>
      route.fulfill({ status: 404, headers: DICOM_WEB_HEADERS, body: "not found in E2E mock" }),
  );

  // --- DICOMweb (Orthanc) ---------------------------------------------------

  // QIDO study list. With a `PatientID` filter this is the prior-studies query
  // from `usePriorStudies`; each fixture patient has exactly one study, so the
  // hook correctly ends up with an empty prior list.
  await page.route(
    (url) => url.pathname === "/dicom-web/studies",
    (route) => {
      const patientId = new URL(route.request().url()).searchParams.get("PatientID");
      const matching = patientId
        ? studies.filter((study) => study.patientId === patientId)
        : studies;
      return dicomJson(route, matching.map(qidoStudyRecord));
    },
  );

  await page.route(
    (url) => /^\/dicom-web\/studies\/[^/]+\/series$/.test(url.pathname),
    (route) => {
      const studyUid = new URL(route.request().url()).pathname.split("/")[3];
      const study = studyByUid.get(studyUid);
      return dicomJson(route, (study?.series ?? []).map(qidoSeriesRecord));
    },
  );

  await page.route(
    (url) => /^\/dicom-web\/studies\/[^/]+\/series\/[^/]+\/instances$/.test(url.pathname),
    (route) => {
      const seriesUid = new URL(route.request().url()).pathname.split("/")[5];
      const series = seriesByUid.get(seriesUid);
      return dicomJson(
        route,
        (series?.instanceUids ?? []).map((uid, index) => qidoInstanceRecord(uid, index + 1)),
      );
    },
  );

  await page.route(
    (url) => /^\/dicom-web\/studies\/.+\/instances\/[^/]+\/metadata$/.test(url.pathname),
    (route) => {
      const segments = new URL(route.request().url()).pathname.split("/");
      const instanceUid = segments[segments.length - 2];
      return dicomJson(route, [qidoInstanceRecord(instanceUid, 1)]);
    },
  );

  // --- Reports --------------------------------------------------------------

  await page.route(
    (url) => url.pathname.startsWith("/api/v1/reports"),
    (route) => {
      const request = route.request();
      const { pathname } = new URL(request.url());
      const method = request.method();
      const tail = pathname.replace(/^\/api\/v1\/reports\/?/, "");

      if (tail === "qa-check") {
        record(calls.qaCheck, route);
        const body = readBody(route) ?? {};
        const warnings = qa.warnings ?? [];
        const failures = qa.failures ?? [];
        // Persist the verdict the way the real service does, so a later
        // finalize response doesn't hand the UI a stale `qa_status`.
        const reportId = typeof body.report_id === "string" ? body.report_id : null;
        const stored = reportId ? reports.get(reportId) : undefined;
        if (stored) {
          reports.set(stored.id, {
            ...stored,
            qa_status: failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
            qa_warnings: warnings,
          });
        }
        return json(route, { passes: qa.passes ?? true, warnings, failures });
      }

      if (tail === "create" && method === "POST") {
        const body = readBody(route) ?? {};
        const id = String(body.report_id ?? `report-${String(body.study_id)}`);
        const existing = reports.get(id);
        if (existing) return json(route, existing);
        const created: ReportPayload = {
          id,
          study_id: String(body.study_id ?? ""),
          patient_id: String(body.patient_id ?? ""),
          status: "pending",
          findings_text: "",
          impression_text: "",
          created_at: "2026-07-21T10:15:00+00:00",
          updated_at: "2026-07-21T10:15:00+00:00",
          approved_at: null,
          approved_by: null,
          qa_status: "pending",
          qa_warnings: [],
        };
        reports.set(id, created);
        return json(route, created);
      }

      if (tail.startsWith("by-patient/")) return json(route, []);

      const finalizeMatch = tail.match(/^(.+)\/finalize$/);
      if (finalizeMatch && method === "POST") {
        record(calls.finalize, route);
        const report = reports.get(finalizeMatch[1]);
        if (!report) return json(route, { detail: "Report not found" }, 404);
        const body = readBody(route) ?? {};
        const signature = typeof body.signature === "string" ? body.signature : null;
        const updated: ReportPayload = {
          ...report,
          status: "finalized",
          approved_by: signature,
          approved_at: "2026-07-21T11:00:00+00:00",
          updated_at: "2026-07-21T11:00:00+00:00",
        };
        reports.set(updated.id, updated);
        return json(route, updated);
      }

      const subResourceMatch = tail.match(/^(.+)\/(revisions|comparisons)$/);
      if (subResourceMatch) {
        return json(route, method === "POST" ? { id: "comparison-1" } : []);
      }

      const report = reports.get(tail);
      if (!report) return json(route, { detail: "Report not found" }, 404);

      if (method === "PATCH") {
        record(calls.reportPatch, route);
        const body = readBody(route) ?? {};
        const updated: ReportPayload = {
          ...report,
          findings_text:
            typeof body.findings_text === "string" ? body.findings_text : report.findings_text,
          impression_text:
            typeof body.impression_text === "string"
              ? body.impression_text
              : report.impression_text,
          status: report.status === "pending" ? "draft" : report.status,
          updated_at: "2026-07-21T10:30:00+00:00",
        };
        reports.set(updated.id, updated);
        return json(route, updated);
      }

      return json(route, report);
    },
  );

  // --- Inference ------------------------------------------------------------

  await page.route(
    (url) => url.pathname === "/api/v1/inference/queue",
    (route) => {
      record(calls.inferenceQueue, route);
      const body = readBody(route) ?? {};
      return json(route, {
        job_id: "job-e2e-1",
        status: "queued",
        report_id: body.report_id ?? null,
        study_id: body.study_id ?? null,
        model_version: inference.modelVersion,
      });
    },
  );

  await page.route(
    (url) => url.pathname.startsWith("/api/v1/inference/status/"),
    (route) => {
      const jobId = new URL(route.request().url()).pathname.split("/").pop() ?? "";
      const attempt = pollCounts.get(jobId) ?? 0;
      pollCounts.set(jobId, attempt + 1);

      const sequence = inference.statuses ?? ["finished"];
      const status = sequence[Math.min(attempt, sequence.length - 1)];

      if (status === "failed") {
        return json(route, {
          job_id: jobId,
          status,
          error: inference.error ?? "Inference job failed",
          result: null,
        });
      }

      return json(route, {
        job_id: jobId,
        status,
        result:
          status === "finished"
            ? {
                summary: inference.summary,
                confidence: inference.confidence,
                model_version: inference.modelVersion,
                completed_at: "2026-07-21T10:45:00+00:00",
              }
            : null,
      });
    },
  );

  return { reports, calls };
}

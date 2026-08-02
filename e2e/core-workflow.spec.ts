import { test, expect, type Page } from "@playwright/test";
import {
  mockApi,
  mockDicomWeb,
  pinPreferences,
  reportIdForStudy,
  type QaCheckFixture,
  type StudyFixture,
} from "./fixtures/backend";

/**
 * The core clinical workflow, end to end: pick a study out of the queue, load
 * its series, write findings, generate the AI impression, read the QA result,
 * and finalize the report with a signature.
 *
 * The backend is stubbed via network mocking (see ./fixtures/backend.ts) - a
 * live docker-compose stack would need seeded Orthanc data and a running
 * inference pipeline, which CI has no way to provide today. Everything above
 * the transport is the real app: real routing, real hooks, real state.
 */

const STUDIES: StudyFixture[] = [
  {
    studyUid: "1.2.826.0.1.3680043.8.498.1001",
    patientId: "MRN-1001",
    patientName: "BERGER^ANNA",
    patientBirthDate: "19710304",
    patientSex: "F",
    studyDate: "20260115",
    studyDescription: "CT Thorax",
    accessionNumber: "ACC-1001",
    modality: "CT",
    referringPhysician: "WEBER^KLAUS",
    series: [
      {
        seriesUid: "1.2.826.0.1.3680043.8.498.1001.1",
        seriesNumber: 2,
        description: "Thorax axial 1mm",
        modality: "CT",
        instanceCount: 3,
      },
      {
        seriesUid: "1.2.826.0.1.3680043.8.498.1001.2",
        seriesNumber: 3,
        description: "Thorax coronal",
        modality: "CT",
        instanceCount: 2,
      },
    ],
  },
  {
    studyUid: "1.2.826.0.1.3680043.8.498.1002",
    patientId: "MRN-1002",
    patientName: "HOFFMANN^PETER",
    patientBirthDate: "19580912",
    patientSex: "M",
    studyDate: "20260116",
    studyDescription: "MR Schaedel",
    accessionNumber: "ACC-1002",
    modality: "MR",
    referringPhysician: "WEBER^KLAUS",
    series: [
      {
        seriesUid: "1.2.826.0.1.3680043.8.498.1002.1",
        seriesNumber: 1,
        description: "T1 axial",
        modality: "MR",
        instanceCount: 4,
      },
    ],
  },
];

const IMPRESSION_TEXT =
  "No acute cardiopulmonary abnormality. Stable 4 mm nodule in the right upper lobe.";

const QA_CHECKS: QaCheckFixture[] = [
  { id: "qa-completeness", name: "Findings section complete", status: "pass" },
  { id: "qa-consistency", name: "Impression consistent with findings", status: "pass" },
  {
    id: "qa-laterality",
    name: "Laterality stated",
    status: "warn",
    message: "Laterality is only stated in the impression.",
  },
];

/** The findings/impression panels share button labels; scope by panel heading. */
const panelHeader = (page: Page, heading: string) =>
  page.locator(".panel-header").filter({ has: page.getByRole("heading", { name: heading }) });

/** Series descriptions and report text also render in the viewer; scope by column. */
const sidebar = (page: Page) => page.locator("aside").first();
const reportPanel = (page: Page) => page.locator("aside").last();

const queueEntry = (page: Page, patientName: string) =>
  sidebar(page).getByRole("button").filter({ hasText: patientName });

test.beforeEach(async ({ page }) => {
  await pinPreferences(page);
  await mockDicomWeb(page, STUDIES);
  await mockApi(page, {
    studies: STUDIES,
    impressionText: IMPRESSION_TEXT,
    qaChecks: QA_CHECKS,
  });
});

test.describe("study selection", () => {
  test("lists the DICOMweb studies in the queue and loads the series of the selected one", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(queueEntry(page, "BERGER, ANNA")).toBeVisible();
    await expect(queueEntry(page, "HOFFMANN, PETER")).toBeVisible();

    // The first study is selected on load, so its series list is what renders.
    await expect(sidebar(page).getByText("Thorax axial 1mm")).toBeVisible();
    await expect(sidebar(page).getByText("Thorax coronal")).toBeVisible();
    await expect(sidebar(page).getByText("3 images")).toBeVisible();
    await expect(sidebar(page).getByText("Series (2)")).toBeVisible();

    await queueEntry(page, "HOFFMANN, PETER").click();

    await expect(sidebar(page).getByText("T1 axial")).toBeVisible();
    await expect(sidebar(page).getByText("Thorax axial 1mm")).toHaveCount(0);
  });
});

test.describe("report workflow", () => {
  // Generating the impression waits out the WebSocket-to-polling fallback in
  // `awaitInferenceResult` (4s) before the stubbed job result is picked up.
  test.slow();

  test("findings -> AI impression -> QA checks -> finalize", async ({ page }) => {
    const reportId = reportIdForStudy(STUDIES[0].studyUid);
    await page.goto("/");
    await expect(queueEntry(page, "BERGER, ANNA")).toBeVisible();

    await test.step("findings are written and saved", async () => {
      const findingsHeader = panelHeader(page, "Findings");
      await findingsHeader.getByRole("button", { name: "Edit" }).click();

      const editor = page.getByRole("textbox", { name: "Findings" });
      await editor.fill("Lungs clear. 4 mm nodule right upper lobe, unchanged.");

      const saved = page.waitForRequest(
        (request) =>
          request.method() === "PATCH" && request.url().includes(`/api/v1/reports/${reportId}`),
      );
      await findingsHeader.getByRole("button", { name: "Save" }).click();
      await saved;

      await expect(
        reportPanel(page).getByText("Lungs clear. 4 mm nodule right upper lobe, unchanged."),
      ).toBeVisible();
    });

    await test.step("the AI impression is generated from the findings", async () => {
      const queued = page.waitForRequest("**/api/v1/inference/queue");
      await reportPanel(page).getByRole("button", { name: "Regenerate" }).click();
      await queued;

      // The generated text lands twice: once in the inference-result card and
      // once as the impression body.
      await expect(reportPanel(page).getByText(IMPRESSION_TEXT).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(reportPanel(page).getByText("e2e-mock")).toBeVisible();
    });

    await test.step("QA checks run against the generated report", async () => {
      const qaSection = reportPanel(page).getByText("QA Checks");
      await expect(qaSection).toBeVisible();
      await qaSection.click();

      for (const check of QA_CHECKS) {
        await expect(reportPanel(page).getByText(check.name)).toBeVisible();
      }
      // The warning also surfaces above the impression, not just in the list.
      await expect(
        reportPanel(page).getByText("Laterality is only stated in the impression."),
      ).toHaveCount(2);
    });

    await test.step("the report is finalized with a signature", async () => {
      await reportPanel(page).getByRole("button", { name: "Approve & Finalize" }).click();

      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Signature").fill("Dr. Anna Berger");

      const finalized = page.waitForRequest(
        (request) =>
          request.method() === "POST" &&
          request.url().includes(`/api/v1/reports/${reportId}/finalize`),
      );
      await dialog.getByRole("button", { name: "Approve & Finalize" }).click();

      expect((await finalized).postDataJSON()).toMatchObject({ signature: "Dr. Anna Berger" });
      await expect(dialog).toBeHidden();
      // Asserting on the toast's presence rather than its copy: the workspace
      // still hardcodes that string in German (see #117).
      await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
    });
  });

  test("approval stays blocked while there is no impression", async ({ page }) => {
    await page.goto("/");
    await expect(queueEntry(page, "BERGER, ANNA")).toBeVisible();

    await expect(
      reportPanel(page).getByRole("button", { name: "Approve & Finalize" }),
    ).toBeDisabled();
  });
});

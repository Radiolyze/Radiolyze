import { test, expect, type Page } from "@playwright/test";
import { STUDY_CR, STUDY_CT, reportIdForStudy } from "./support/fixtures";
import { mockWorkflowBackend, pinEnglishLocale } from "./support/mockBackend";

/**
 * Core clinical workflow E2E: select study -> AI findings -> QA -> finalize.
 *
 * This is the flow issue #116 exists for. The backend is stubbed at the network
 * layer (see `support/mockBackend.ts`) rather than run as a docker stack, so the
 * app's own mapping, polling and state code runs unchanged while the suite stays
 * fast and deterministic in CI.
 *
 * Inference completion takes a few seconds here by design: no WebSocket is
 * connected, so `awaitInferenceResult` falls through to its HTTP polling
 * fallback — the same path a real deployment takes when the socket is down.
 */

/** Inference plus its QA round trip; generous because polling is the slow path. */
const AI_TIMEOUT = 30_000;

const viewer = (page: Page) => page.getByRole("main");
const sidebar = (page: Page) => page.getByRole("complementary").first();
const reportPanel = (page: Page) => page.getByRole("complementary").nth(1);

const queueItem = (page: Page, patientName: string) =>
  sidebar(page).getByRole("button", { name: new RegExp(patientName) });

const seriesItem = (page: Page, description: string) =>
  sidebar(page).getByRole("button", { name: new RegExp(description) });

/**
 * Waits for the workspace to finish loading the queue and mount the viewer.
 * Generous, because on a cold run this is the request that makes Vite compile
 * the Cornerstone-heavy route for the first time.
 */
const waitForWorkspace = async (page: Page) => {
  await expect(viewer(page).getByText(STUDY_CT.series[0].description)).toBeVisible({
    timeout: 30_000,
  });
};

test.beforeEach(async ({ page }) => {
  await pinEnglishLocale(page);
});

test.describe("study selection", () => {
  test("loads the first queued study, its series and its report", async ({ page }) => {
    await mockWorkflowBackend(page);
    await page.goto("/");
    await waitForWorkspace(page);

    // Both studies are queued, the first is selected.
    await expect(queueItem(page, STUDY_CT.patientDisplayName)).toBeVisible();
    await expect(queueItem(page, STUDY_CR.patientDisplayName)).toBeVisible();
    await expect(
      sidebar(page).getByRole("heading", { name: STUDY_CT.patientDisplayName }),
    ).toBeVisible();

    // Its series list comes from DICOMweb, with instance counts resolved.
    await expect(sidebar(page).getByText(`Series (${STUDY_CT.series.length})`)).toBeVisible();
    await expect(seriesItem(page, STUDY_CT.series[1].description)).toContainText("3 images");

    // The first series is loaded into the viewer.
    await expect(viewer(page).getByText(STUDY_CT.series[0].description)).toBeVisible();
    await expect(viewer(page).getByText("Im: 1/1")).toBeVisible();
  });

  test("selecting a series loads that series into the viewer", async ({ page }) => {
    await mockWorkflowBackend(page);
    await page.goto("/");
    await waitForWorkspace(page);

    await seriesItem(page, STUDY_CT.series[1].description).click();

    await expect(viewer(page).getByText(STUDY_CT.series[1].description)).toBeVisible();
    await expect(viewer(page).getByText("CT • Series 2")).toBeVisible();
    // Three instances in that series, so the stack carries three frames.
    await expect(viewer(page).getByText("Im: 1/3")).toBeVisible();
  });

  test("selecting another study swaps patient, series and report", async ({ page }) => {
    await mockWorkflowBackend(page, {
      reportOverrides: {
        [reportIdForStudy(STUDY_CR)]: { findings_text: "Prior draft for the second study." },
      },
    });
    await page.goto("/");
    await waitForWorkspace(page);

    await queueItem(page, STUDY_CR.patientDisplayName).click();

    await expect(
      sidebar(page).getByRole("heading", { name: STUDY_CR.patientDisplayName }),
    ).toBeVisible();
    await expect(sidebar(page).getByText(`Series (${STUDY_CR.series.length})`)).toBeVisible();
    await expect(viewer(page).getByText(STUDY_CR.series[0].description)).toBeVisible();
    // The report travels with the study, not just the images.
    await expect(reportPanel(page).getByText("Prior draft for the second study.")).toBeVisible();
  });
});

test.describe("core report workflow", () => {
  test("AI analysis fills findings and impression, then QA passes", async ({ page }) => {
    const summary = "Small left pleural effusion.";
    const backend = await mockWorkflowBackend(page, { inference: { summary } });
    await page.goto("/");
    await waitForWorkspace(page);

    await expect(reportPanel(page).getByText("Pending")).toBeVisible();

    await reportPanel(page).getByRole("button", { name: "AI Analysis" }).click();

    // The generated summary is written into the report...
    await expect(reportPanel(page).getByText(summary).first()).toBeVisible({ timeout: AI_TIMEOUT });
    // ...including the findings, whose word count is derived from that text.
    await expect(reportPanel(page).getByText("4 words")).toBeVisible();
    // The run's provenance is shown alongside it.
    await expect(reportPanel(page).getByText("Model: e2e-mock-1")).toBeVisible();
    await expect(reportPanel(page).getByText("Confidence: 91%")).toBeVisible();
    // QA runs off the back of the analysis and reports its verdict.
    await expect(reportPanel(page).getByText("Passed")).toBeVisible({ timeout: AI_TIMEOUT });

    // The job was queued for this report and study, with the viewer's frames attached.
    expect(backend.calls.inferenceQueue).toHaveLength(1);
    const queued = backend.calls.inferenceQueue[0].body ?? {};
    expect(queued.report_id).toBe(reportIdForStudy(STUDY_CT));
    expect(queued.study_id).toBe(STUDY_CT.uid);
    expect(Array.isArray(queued.image_refs) && queued.image_refs.length).toBeGreaterThan(0);

    // QA was checked against the text the model produced, not stale state.
    expect(backend.calls.qaCheck).toHaveLength(1);
    expect(backend.calls.qaCheck[0].body?.findings_text).toBe(summary);
  });

  test("edited findings are persisted and drive impression generation", async ({ page }) => {
    const summary = "No acute finding.";
    const backend = await mockWorkflowBackend(page, { inference: { summary } });
    await page.goto("/");
    await waitForWorkspace(page);

    const findings = "Clear lungs.";
    await reportPanel(page).getByRole("button", { name: "Edit" }).first().click();
    await reportPanel(page).getByRole("textbox", { name: "Findings" }).fill(findings);
    await reportPanel(page).getByRole("button", { name: "Save" }).first().click();

    await expect
      .poll(() => backend.calls.reportPatch.length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    expect(backend.calls.reportPatch[0].body?.findings_text).toBe(findings);
    expect(backend.reports.get(reportIdForStudy(STUDY_CT))?.findings_text).toBe(findings);

    await reportPanel(page).getByRole("button", { name: "Regenerate" }).click();

    await expect(reportPanel(page).getByText(summary).first()).toBeVisible({ timeout: AI_TIMEOUT });
    await expect(reportPanel(page).getByText("Passed")).toBeVisible({ timeout: AI_TIMEOUT });
    // The impression was generated from the edited findings.
    expect(backend.calls.inferenceQueue[0].body?.findings_text).toBe(findings);
  });

  test("QA warnings are surfaced instead of a pass", async ({ page }) => {
    const warning = "Impression does not mention the effusion.";
    await mockWorkflowBackend(page, {
      inference: { summary: "Small left pleural effusion." },
      qa: { passes: false, warnings: [warning] },
    });
    await page.goto("/");
    await waitForWorkspace(page);

    await reportPanel(page).getByRole("button", { name: "AI Analysis" }).click();

    await expect(reportPanel(page).getByText("Warnings")).toBeVisible({ timeout: AI_TIMEOUT });
    await expect(reportPanel(page).getByText(warning)).toBeVisible();
    // A warning is not a blocker — the report can still be approved.
    await expect(
      reportPanel(page).getByRole("button", { name: "Approve & Finalize" }),
    ).toBeEnabled();
  });

  test("approving finalizes the report with the signature", async ({ page }) => {
    const summary = "Small left pleural effusion.";
    const backend = await mockWorkflowBackend(page, { inference: { summary } });
    await page.goto("/");
    await waitForWorkspace(page);

    const approve = reportPanel(page).getByRole("button", { name: "Approve & Finalize" });
    // Nothing to approve until an impression exists.
    await expect(approve).toBeDisabled();

    await reportPanel(page).getByRole("button", { name: "AI Analysis" }).click();
    await expect(reportPanel(page).getByText("Passed")).toBeVisible({ timeout: AI_TIMEOUT });
    await expect(approve).toBeEnabled();

    await approve.click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByLabel("Signature").fill("Dr. Jane Doe");
    await dialog.getByRole("button", { name: "Approve & Finalize" }).click();

    await expect(dialog).toBeHidden();
    await expect.poll(() => backend.calls.finalize.length, { timeout: 10_000 }).toBe(1);
    expect(backend.calls.finalize[0].body?.signature).toBe("Dr. Jane Doe");

    const finalized = backend.reports.get(reportIdForStudy(STUDY_CT));
    expect(finalized?.status).toBe("finalized");
    expect(finalized?.approved_by).toBe("Dr. Jane Doe");

    // The finalize response is folded back into the report without clobbering
    // the QA verdict that gated the approval.
    await expect(reportPanel(page).getByText("Passed")).toBeVisible();
  });

  test("a failed inference job leaves the report un-approvable", async ({ page }) => {
    await mockWorkflowBackend(page, {
      inference: { summary: "unused", statuses: ["started", "failed"], error: "vLLM unavailable" },
    });
    await page.goto("/");
    await waitForWorkspace(page);

    await reportPanel(page).getByRole("button", { name: "AI Analysis" }).click();

    // The button returns to its idle label once the job fails...
    await expect(reportPanel(page).getByRole("button", { name: "AI Analysis" })).toBeEnabled({
      timeout: AI_TIMEOUT,
    });
    // ...and nothing was written into the report, so it cannot be approved.
    await expect(
      reportPanel(page).getByRole("button", { name: "Approve & Finalize" }),
    ).toBeDisabled();
  });
});

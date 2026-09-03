import { test, expect, type Page } from "@playwright/test";
import { STUDY_CT, reportIdForStudy } from "./support/fixtures";
import { mockWorkflowBackend, pinEnglishLocale, pinUserPreferences } from "./support/mockBackend";
import { reportPanel, waitForWorkspace } from "./support/workspace";

/**
 * Dictation (ASR) E2E: record -> transcribe -> transcript lands in the findings.
 *
 * The one thing this flow needs beyond the other mocked specs is a microphone.
 * Chromium's fake capture device (see `playwright.config.ts`) supplies one, so
 * `useAudioInput`'s real `getUserMedia`/`MediaRecorder` path runs and produces a
 * genuine WebM blob; only the transcription endpoint is stubbed.
 *
 * Note both specs assert the *stubbed* transcript. `VITE_ALLOW_MOCK_FALLBACK`
 * makes `useASR` substitute a random canned transcript whenever transcription
 * fails, which would otherwise let this suite pass while the ASR path is broken
 * — with these assertions, that env var turns the specs red instead.
 */

/** Long enough for the fake device to fill a MediaRecorder chunk. */
const RECORD_MS = 800;

const micButton = (page: Page, recording: boolean) =>
  reportPanel(page).getByRole("button", {
    name: recording ? "Stop recording" : "Start dictation (Ctrl+M)",
  });

test.use({ permissions: ["microphone"] });

test("dictation transcribes the recording into the findings", async ({ page }) => {
  const transcript = "Trachea midline, no pneumothorax.";
  await pinEnglishLocale(page);
  const backend = await mockWorkflowBackend(page, { asr: { text: transcript, confidence: 0.87 } });
  await page.goto("/");
  await waitForWorkspace(page);

  await micButton(page, false).click();
  await expect(reportPanel(page).getByText("Recording")).toBeVisible();
  await page.waitForTimeout(RECORD_MS);
  await micButton(page, true).click();

  // The transcript is appended to the findings behind a timestamp.
  const findings = reportPanel(page).getByText(transcript);
  await expect(findings).toBeVisible({ timeout: 15_000 });
  await expect(findings).toHaveText(/^\[[\d:\s\u202fAPM.]+\]\s/);
  // Its confidence comes from the service, not from the recording animation.
  await expect(reportPanel(page).getByText("87%")).toBeVisible();

  // One upload, carrying a non-empty recording and the report it belongs to.
  expect(backend.calls.asrTranscript).toHaveLength(1);
  const upload = backend.calls.asrTranscript[0].body ?? {};
  expect(upload.report_id).toBe(reportIdForStudy(STUDY_CT));
  expect(upload.filename).toBe("dictation.webm");
  expect(Number(upload.audioBytes)).toBeGreaterThan(0);
  // The dictation language is the ASR preference, not the UI language: the UI
  // is pinned to English here and `asrLanguage` keeps its 'de-DE' default.
  expect(upload.language).toBe("de-DE");
});

test("a failed transcription leaves the findings untouched", async ({ page }) => {
  await pinUserPreferences(page, { uiLanguage: "en", asrLanguage: "en-US" });
  const backend = await mockWorkflowBackend(page, { asr: { status: 503 } });
  await page.goto("/");
  await waitForWorkspace(page);

  const placeholder = reportPanel(page).getByText("Enter findings...");
  await expect(placeholder).toBeVisible();

  await micButton(page, false).click();
  await expect(reportPanel(page).getByText("Recording")).toBeVisible();
  await page.waitForTimeout(RECORD_MS);
  await micButton(page, true).click();

  // The recorder returns to idle rather than hanging in "Processing speech...",
  // and nothing is written into the report — no invented transcript.
  await expect(micButton(page, false)).toBeEnabled({ timeout: 15_000 });
  await expect(placeholder).toBeVisible();

  expect(backend.calls.asrTranscript).toHaveLength(1);
  expect(backend.calls.asrTranscript[0].body?.language).toBe("en-US");
  expect(backend.calls.reportPatch).toHaveLength(0);
});

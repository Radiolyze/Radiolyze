/**
 * Locators and waits shared by the specs that drive the report workspace.
 *
 * The workspace is three landmarks: the queue/series sidebar, the viewer, and
 * the report panel. Addressing them by role keeps the specs from depending on
 * class names or DOM order inside the panels.
 */

import { expect, type Page } from "@playwright/test";
import { STUDY_CT } from "./fixtures";

/** Inference plus its QA round trip; generous because polling is the slow path. */
export const AI_TIMEOUT = 30_000;

export const viewer = (page: Page) => page.getByRole("main");
export const sidebar = (page: Page) => page.getByRole("complementary").first();
export const reportPanel = (page: Page) => page.getByRole("complementary").nth(1);

export const queueItem = (page: Page, patientName: string) =>
  sidebar(page).getByRole("button", { name: new RegExp(patientName) });

export const seriesItem = (page: Page, description: string) =>
  sidebar(page).getByRole("button", { name: new RegExp(description) });

/**
 * Waits for the workspace to finish loading the queue and mount the viewer.
 * Generous, because on a cold run this is the request that makes Vite compile
 * the Cornerstone-heavy route for the first time.
 */
export const waitForWorkspace = async (page: Page) => {
  await expect(viewer(page).getByText(STUDY_CT.series[0].description)).toBeVisible({
    timeout: 30_000,
  });
};

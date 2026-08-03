import { useCallback } from "react";
import type { AIStatus, ImageRef, Report } from "@/types/radiology";
import { mockAIImpressions } from "@/data/mockData";
import { ApiError } from "@/services/apiClient";
import { impressionClient } from "@/services/impressionClient";
import { inferenceClient } from "@/services/inferenceClient";
import {
  extractInferenceCompletedAt,
  extractInferenceConfidence,
  extractInferenceEvidenceIndices,
  extractInferenceFindings,
  extractInferenceImageRefs,
  extractInferenceMetadata,
  extractInferenceModel,
  extractInferenceSummary,
  awaitInferenceResult,
  selectInferenceImageRefs,
} from "@/hooks/reporting/inferenceHelpers";
import { logger } from "@/lib/logger";

const allowMockFallback = import.meta.env.VITE_ALLOW_MOCK_FALLBACK === "true";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface InferenceRequestOptions {
  reportId?: string;
  studyId?: string;
  requestedBy?: string;
  modelVersion?: string;
  imageRefs?: ImageRef[];
  priorImageRefs?: ImageRef[];
  includeAllFrames?: boolean;
  onStatus?: (status: AIStatus) => void;
}

export interface AnalyzeImagesResult {
  findings: string;
  impression: string;
}

interface UseInferenceParams {
  report: Report | null;
  setReport: React.Dispatch<React.SetStateAction<Report | null>>;
  setIsLoading: (loading: boolean) => void;
}

export interface UseInferenceReturn {
  generateImpression: (findings: string, options?: InferenceRequestOptions) => Promise<string>;
  analyzeImages: (options?: InferenceRequestOptions) => Promise<AnalyzeImagesResult>;
}

/**
 * Advance the report to whatever status an edit implies.
 *
 * A report that was still `pending`/`in_progress` becomes a `draft` as soon as
 * it has text; anything further along keeps the status it already had.
 */
const withDraftStatus = (status: Report["status"]): Report["status"] =>
  status === "pending" || status === "in_progress" ? "draft" : status;

/**
 * The AI half of `useReport`: queue an inference job, wait for it, merge the
 * result into the report.
 *
 * `generateImpression` and `analyzeImages` are the same job with three
 * differences, so they share one runner rather than one copy each:
 *
 * - `generateImpression` sends the findings text and writes the summary to
 *   `impressionText`; `analyzeImages` sends nothing and writes the summary to
 *   both `findingsText` and `impressionText` (the AI read the images, so its
 *   output is the findings).
 * - `generateImpression` falls back to the impression service — and then, only
 *   when `VITE_ALLOW_MOCK_FALLBACK` is set, to a canned impression — when the
 *   job fails for a transient reason. `analyzeImages` has no such fallback:
 *   there is no text-only path to an image reading.
 */
export function useInference({
  report,
  setReport,
  setIsLoading,
}: UseInferenceParams): UseInferenceReturn {
  const reportId = report?.id;
  const studyId = report?.studyId;

  /**
   * Queue a job, wait for the result and merge it into the report.
   *
   * Returns the summary. Throws whatever the inference path threw, having
   * already marked the report's `inferenceStatus` as failed, so a caller can
   * decide whether to fall back.
   */
  const runInferenceJob = useCallback(
    async (findingsText: string, options: InferenceRequestOptions | undefined) => {
      const targetReportId = options?.reportId ?? reportId;
      const targetStudyId = options?.studyId ?? studyId;
      const onStatus = options?.onStatus;
      const modelVersion = options?.modelVersion;

      const selectedImageRefs = [
        ...selectInferenceImageRefs(options?.imageRefs, {
          includeAllFrames: options?.includeAllFrames,
          role: "current",
        }),
        ...selectInferenceImageRefs(options?.priorImageRefs, {
          includeAllFrames: options?.includeAllFrames,
          role: "prior",
        }),
      ];

      try {
        onStatus?.("queued");
        const queueResponse = await inferenceClient.queueInference({
          reportId: targetReportId,
          studyId: targetStudyId,
          findingsText,
          imageUrls: selectedImageRefs.map((ref) => ref.inferenceUrl ?? ref.wadoUrl),
          imageRefs: selectedImageRefs,
          requestedBy: options?.requestedBy,
          modelVersion,
        });

        const jobId = queueResponse.job_id ?? queueResponse.jobId;
        if (!jobId) {
          throw new Error("Inference queue missing job id");
        }

        setReport((prev) =>
          prev
            ? {
                ...prev,
                inferenceJobId: jobId,
                inferenceStatus: queueResponse.status ?? "queued",
                inferenceModelVersion:
                  queueResponse.model_version ?? queueResponse.modelVersion ?? modelVersion,
                inferenceImageRefs: selectedImageRefs,
              }
            : null,
        );

        const result = await awaitInferenceResult(jobId, targetReportId, onStatus);
        const summary = extractInferenceSummary(result);
        if (!summary) {
          throw new Error("Inference result missing summary");
        }

        const inferredModel = extractInferenceModel(result);
        const inferredImageRefs = extractInferenceImageRefs(result);
        const evidenceIndices = extractInferenceEvidenceIndices(result);
        const inferenceFindings = extractInferenceFindings(result);
        const inferenceMetadata = extractInferenceMetadata(result);
        const confidence = extractInferenceConfidence(result);
        const completedAt = extractInferenceCompletedAt(result);

        setReport((prev) =>
          prev
            ? {
                ...prev,
                impressionText: summary,
                updatedAt: new Date().toISOString(),
                status: withDraftStatus(prev.status),
                inferenceStatus: "finished",
                inferenceSummary: summary,
                inferenceConfidence: confidence,
                inferenceModelVersion: inferredModel ?? prev.inferenceModelVersion ?? modelVersion,
                inferenceCompletedAt: completedAt,
                inferenceImageRefs:
                  inferredImageRefs ?? prev.inferenceImageRefs ?? selectedImageRefs,
                inferenceEvidenceIndices: evidenceIndices ?? prev.inferenceEvidenceIndices,
                inferenceFindings: inferenceFindings ?? prev.inferenceFindings,
                inferenceMetadata: inferenceMetadata ?? prev.inferenceMetadata,
              }
            : null,
        );

        return summary;
      } catch (error) {
        setReport((prev) => (prev ? { ...prev, inferenceStatus: "failed" } : null));
        throw error;
      }
    },
    [reportId, setReport, studyId],
  );

  const generateImpression = useCallback(
    async (findings: string, options?: InferenceRequestOptions): Promise<string> => {
      setIsLoading(true);
      const onStatus = options?.onStatus;
      let succeeded = false;

      try {
        const summary = await runInferenceJob(findings, options);
        succeeded = true;
        return summary;
      } catch (error) {
        // Only fall back for transient/network errors. Client errors (4xx)
        // indicate a bug or bad input — don't mask them.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          throw error;
        }

        logger.warn("Inference queue failed, falling back to impression service.", error);
        onStatus?.("processing");

        try {
          const response = await impressionClient.generateImpression({
            reportId: options?.reportId ?? reportId,
            findingsText: findings,
          });

          const impression = response.text?.trim() || "";
          if (!impression) {
            throw new Error("Impression response missing text");
          }

          setReport((prev) =>
            prev
              ? {
                  ...prev,
                  impressionText: impression,
                  updatedAt: new Date().toISOString(),
                  status: withDraftStatus(prev.status),
                }
              : null,
          );

          succeeded = true;
          return impression;
        } catch (fallbackError) {
          if (!allowMockFallback) {
            logger.warn("Impression service failed.", fallbackError);
            onStatus?.("error");
            throw fallbackError;
          }

          logger.warn("Impression service failed, using mock impression.", fallbackError);

          await wait(1200 + Math.random() * 800);
          const impression =
            mockAIImpressions[Math.floor(Math.random() * mockAIImpressions.length)];

          setReport((prev) =>
            prev
              ? {
                  ...prev,
                  impressionText: impression,
                  updatedAt: new Date().toISOString(),
                  status: withDraftStatus(prev.status),
                }
              : null,
          );

          succeeded = true;
          return impression;
        }
      } finally {
        setIsLoading(false);
        if (succeeded) {
          onStatus?.("idle");
        }
      }
    },
    [reportId, runInferenceJob, setIsLoading, setReport],
  );

  const analyzeImages = useCallback(
    async (options?: InferenceRequestOptions): Promise<AnalyzeImagesResult> => {
      setIsLoading(true);
      const onStatus = options?.onStatus;
      let succeeded = false;

      try {
        // No findings text — the AI reads the images and writes the findings.
        const summary = await runInferenceJob("", options);
        setReport((prev) => (prev ? { ...prev, findingsText: summary } : null));
        succeeded = true;
        return { findings: summary, impression: summary };
      } catch (error) {
        logger.warn("Image analysis failed.", error);
        onStatus?.("error");
        throw error;
      } finally {
        setIsLoading(false);
        if (succeeded) {
          onStatus?.("idle");
        }
      }
    },
    [runInferenceJob, setIsLoading, setReport],
  );

  return { generateImpression, analyzeImages };
}

import i18n from "@/i18n";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { AIStatus, ImageRef, Report } from "@/types/radiology";
import type { AnalyzeImagesResult, GenerateImpressionOptions } from "@/hooks/useReport";
import type { QaCheckInput, QaCheckOutcome } from "@/hooks/reporting/useQaChecks";
import { inferenceClient } from "@/services/inferenceClient";
import { extractInferenceFindings, pollInferenceResult } from "@/hooks/reporting/inferenceHelpers";
import { logger } from "@/lib/logger";

interface UseWorkspaceInferenceOptions {
  report: Report | null;
  setReport: React.Dispatch<React.SetStateAction<Report | null>>;
  /** Study the loaded images belong to; frame analysis is refused without it. */
  studyId?: string;
  findings: string;
  setFindings: (text: string) => void;
  setImpression: (text: string) => void;
  imageRefs: ImageRef[];
  priorImageRefs: ImageRef[];
  includeAllFrames: boolean;
  generateImpression: (findings: string, options?: GenerateImpressionOptions) => Promise<string>;
  analyzeImages: (options?: GenerateImpressionOptions) => Promise<AnalyzeImagesResult>;
  runQAChecks: (input?: QaCheckInput) => Promise<QaCheckOutcome>;
  /** AI status pushed over the WebSocket for this report, if any. */
  liveAiStatus?: AIStatus;
}

export interface UseWorkspaceInferenceResult {
  /** Local status merged with the live one — what the viewer should display. */
  aiStatus: AIStatus;
  isGenerating: boolean;
  isAnalyzingImages: boolean;
  isAnalyzingFrame: boolean;
  generateImpression: () => Promise<void>;
  analyzeImages: () => Promise<void>;
  analyzeFrame: (imageRef: ImageRef) => Promise<void>;
}

/**
 * The three ways this workspace asks the model for something: an impression
 * from written findings, a full read of the loaded images, and localization of
 * a single frame.
 *
 * They share one status, and that status has two sources — the job this tab
 * started, and whatever the WebSocket reports for the same report, which is how
 * a job started elsewhere still shows up here. A local status wins once set,
 * except that a live `error` always wins: a failure the backend knows about is
 * not something a stale local `idle` should hide.
 */
export function useWorkspaceInference({
  report,
  setReport,
  studyId,
  findings,
  setFindings,
  setImpression,
  imageRefs,
  priorImageRefs,
  includeAllFrames,
  generateImpression,
  analyzeImages,
  runQAChecks,
  liveAiStatus,
}: UseWorkspaceInferenceOptions): UseWorkspaceInferenceResult {
  const [localAiStatus, setLocalAiStatus] = useState<AIStatus>("idle");
  const [isAnalyzingImages, setIsAnalyzingImages] = useState(false);
  const [isAnalyzingFrame, setIsAnalyzingFrame] = useState(false);

  const reportId = report?.id;

  const aiStatus: AIStatus =
    liveAiStatus === "error"
      ? "error"
      : localAiStatus === "idle"
        ? (liveAiStatus ?? "idle")
        : localAiStatus;

  const isGenerating = aiStatus === "queued" || aiStatus === "processing";

  useEffect(() => {
    setLocalAiStatus("idle");
  }, [reportId]);

  const handleGenerateImpression = useCallback(async () => {
    if (!findings?.trim() || isGenerating) return;

    try {
      const result = await generateImpression(findings, {
        onStatus: setLocalAiStatus,
        imageRefs,
        priorImageRefs,
        includeAllFrames,
      });
      setImpression(result);
      await runQAChecks({
        reportId,
        findingsText: findings,
        impressionText: result,
      });
    } catch (error) {
      logger.warn("Failed to generate impression", error);
      setLocalAiStatus("error");
      toast.error(i18n.t("errors:report.generateFailed"));
    }
  }, [
    findings,
    generateImpression,
    imageRefs,
    isGenerating,
    priorImageRefs,
    reportId,
    runQAChecks,
    setImpression,
    includeAllFrames,
  ]);

  const handleAnalyzeImages = useCallback(async () => {
    if (isGenerating || isAnalyzingImages) return;
    if (imageRefs.length === 0 && priorImageRefs.length === 0) {
      toast.error(i18n.t("errors:report.noImagesToAnalyze"));
      return;
    }

    setIsAnalyzingImages(true);
    try {
      const result = await analyzeImages({
        onStatus: setLocalAiStatus,
        imageRefs,
        priorImageRefs,
        includeAllFrames,
      });
      setFindings(result.findings);
      setImpression(result.impression);
      await runQAChecks({
        reportId,
        findingsText: result.findings,
        impressionText: result.impression,
      });
      toast.success(i18n.t("viewer:progress.ai.completed"));
    } catch (error) {
      logger.warn("Failed to analyze images", error);
      setLocalAiStatus("error");
      toast.error(i18n.t("errors:report.generateFailed"));
    } finally {
      setIsAnalyzingImages(false);
    }
  }, [
    analyzeImages,
    imageRefs,
    isAnalyzingImages,
    isGenerating,
    priorImageRefs,
    reportId,
    runQAChecks,
    setFindings,
    setImpression,
    includeAllFrames,
  ]);

  const analyzeFrame = useCallback(
    async (imageRef: ImageRef) => {
      if (isAnalyzingFrame || isGenerating) return;
      if (!reportId || !studyId) {
        toast.error(i18n.t("errors:report.noneSelected"));
        return;
      }
      setIsAnalyzingFrame(true);
      try {
        const response = await inferenceClient.queueLocalize({
          reportId,
          studyId,
          imageRef,
        });
        const jobId = response.job_id ?? response.jobId;
        if (!jobId) {
          throw new Error("Keine Job-ID erhalten");
        }
        const result = await pollInferenceResult(jobId, setLocalAiStatus);
        const newFindings = extractInferenceFindings(result);
        if (newFindings && newFindings.length > 0) {
          setReport((prev) =>
            prev
              ? {
                  ...prev,
                  inferenceFindings: [...(prev.inferenceFindings ?? []), ...newFindings],
                }
              : prev,
          );
          toast.success(`${newFindings.length} Befund(e) lokalisiert`);
        } else {
          toast.info("Keine Befunde in diesem Frame erkannt");
        }
      } catch (error) {
        logger.warn("Frame-Lokalisierung fehlgeschlagen", error);
        setLocalAiStatus("error");
        toast.error(i18n.t("errors:report.frameAnalysisFailed"));
      } finally {
        setIsAnalyzingFrame(false);
      }
    },
    [isAnalyzingFrame, isGenerating, reportId, studyId, setReport],
  );

  return {
    aiStatus,
    isGenerating,
    isAnalyzingImages,
    isAnalyzingFrame,
    generateImpression: handleGenerateImpression,
    analyzeImages: handleAnalyzeImages,
    analyzeFrame,
  };
}

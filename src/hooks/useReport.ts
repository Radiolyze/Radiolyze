import { useState } from "react";
import type { QACheck, Report } from "@/types/radiology";
import {
  useInference,
  type AnalyzeImagesResult,
  type InferenceRequestOptions,
} from "@/hooks/reporting/useInference";
import { useReportMutations } from "@/hooks/reporting/useReportMutations";
import { useQaChecks, type QaCheckInput, type QaCheckOutcome } from "@/hooks/reporting/useQaChecks";

export type GenerateImpressionOptions = InferenceRequestOptions;
export type AnalyzeImagesOptions = InferenceRequestOptions;
export type { AnalyzeImagesResult };

interface UseReportReturn {
  report: Report | null;
  isLoading: boolean;
  error: string | null;
  qaChecks: QACheck[];
  updateFindings: (text: string) => Promise<void>;
  updateImpression: (text: string) => Promise<void>;
  generateImpression: (findings: string, options?: GenerateImpressionOptions) => Promise<string>;
  analyzeImages: (options?: AnalyzeImagesOptions) => Promise<AnalyzeImagesResult>;
  runQAChecks: (input?: QaCheckInput) => Promise<QaCheckOutcome>;
  approveReport: (signature: string) => Promise<void>;
  setReport: React.Dispatch<React.SetStateAction<Report | null>>;
}

/**
 * The report editing surface: the report itself plus everything a workspace
 * does to it.
 *
 * This is a composition of three focused hooks, each usable on its own:
 *
 * - `useReportMutations` — findings, impression and approval round trips
 * - `useInference` — queue an AI job and merge its result
 * - `useQaChecks` — run the QA checks and mirror the outcome
 *
 * They share `report`/`setReport` and the `isLoading`/`error` pair, which is
 * why those live here rather than in any one of them. Nothing else is shared:
 * a component that only needs QA can take `useQaChecks` directly instead of
 * dragging the inference client in with it.
 */
export function useReport(initialReport?: Report): UseReportReturn {
  const [report, setReport] = useState<Report | null>(initialReport || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { updateFindings, updateImpression, approveReport } = useReportMutations({
    report,
    setReport,
    setIsLoading,
    setError,
  });

  const { generateImpression, analyzeImages } = useInference({
    report,
    setReport,
    setIsLoading,
  });

  const { qaChecks, runQAChecks } = useQaChecks({ report, setReport });

  return {
    report,
    isLoading,
    error,
    qaChecks,
    updateFindings,
    updateImpression,
    generateImpression,
    analyzeImages,
    runQAChecks,
    approveReport,
    setReport,
  };
}

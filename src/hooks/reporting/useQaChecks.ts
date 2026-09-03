import i18n from "@/i18n";
import { useCallback, useState } from "react";
import type { QACheck, QAStatus, Report } from "@/types/radiology";
import { mockQAChecks } from "@/data/mockData";
import { qaClient } from "@/services/qaClient";
import {
  buildChecksFromService,
  getQaStatus,
  getWarningsFromChecks,
} from "@/hooks/reporting/qaHelpers";
import { logger } from "@/lib/logger";

const allowMockFallback = import.meta.env.VITE_ALLOW_MOCK_FALLBACK === "true";

export interface QaCheckInput {
  reportId?: string;
  findingsText?: string;
  impressionText?: string;
}

export interface QaCheckOutcome {
  status: QAStatus;
  checks: QACheck[];
  warnings: string[];
}

interface UseQaChecksParams {
  report: Report | null;
  setReport: React.Dispatch<React.SetStateAction<Report | null>>;
}

export interface UseQaChecksReturn {
  qaChecks: QACheck[];
  runQAChecks: (input?: QaCheckInput) => Promise<QaCheckOutcome>;
}

/**
 * The QA half of `useReport`: run the checks and mirror the outcome onto the
 * report.
 *
 * `runQAChecks` never rejects. QA is advisory — a failed check run should show
 * the radiologist a warning, not break the editor — so a request failure
 * resolves to a `warn` outcome (or, when `VITE_ALLOW_MOCK_FALLBACK` is set,
 * to the canned checks).
 */
export function useQaChecks({ report, setReport }: UseQaChecksParams): UseQaChecksReturn {
  const [qaChecks, setQaChecks] = useState<QACheck[]>(allowMockFallback ? mockQAChecks : []);

  const reportId = report?.id;
  const findingsText = report?.findingsText;
  const impressionText = report?.impressionText;

  const publish = useCallback(
    (outcome: QaCheckOutcome): QaCheckOutcome => {
      setQaChecks(outcome.checks);
      setReport((prev) =>
        prev ? { ...prev, qaStatus: outcome.status, qaWarnings: outcome.warnings } : null,
      );
      return outcome;
    },
    [setReport],
  );

  const runQAChecks = useCallback(
    async (input?: QaCheckInput): Promise<QaCheckOutcome> => {
      setReport((prev) => (prev ? { ...prev, qaStatus: "checking" } : null));

      try {
        const response = await qaClient.runChecks({
          reportId: input?.reportId ?? reportId,
          findingsText: input?.findingsText ?? findingsText ?? "",
          impressionText: input?.impressionText ?? impressionText ?? "",
        });

        const checks = buildChecksFromService(response);
        return publish({
          checks,
          warnings: getWarningsFromChecks(checks, response),
          status: getQaStatus(checks, response),
        });
      } catch (error) {
        if (!allowMockFallback) {
          logger.warn("QA check failed.", error);
          return publish({
            checks: [],
            warnings: [i18n.t("errors:qa.checkFailed")],
            status: "warn",
          });
        }

        logger.warn("QA check failed, using mock checks.", error);
        return publish({
          checks: mockQAChecks,
          warnings: getWarningsFromChecks(mockQAChecks),
          status: getQaStatus(mockQAChecks),
        });
      }
    },
    [findingsText, impressionText, publish, reportId, setReport],
  );

  return { qaChecks, runQAChecks };
}

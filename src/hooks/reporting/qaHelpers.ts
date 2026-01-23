import type { QACheck, QAStatus } from '@/types/radiology';
import type { QAServiceResponse } from '@/services/qaClient';

export const buildChecksFromService = (response: QAServiceResponse): QACheck[] => {
  if (Array.isArray(response.checks) && response.checks.length > 0) {
    return response.checks;
  }

  const failures = Array.isArray(response.failures) ? response.failures : [];
  const warnings = Array.isArray(response.warnings) ? response.warnings : [];
  const checks: QACheck[] = [];

  failures.forEach((message, index) => {
    const trimmed = message?.trim();
    checks.push({
      id: `qa-fail-${index}`,
      name: trimmed || 'QA Fehler',
      status: 'fail',
      message: trimmed || undefined,
    });
  });

  warnings.forEach((message, index) => {
    const trimmed = message?.trim();
    checks.push({
      id: `qa-warn-${index}`,
      name: trimmed || 'QA Warnung',
      status: 'warn',
      message: trimmed || undefined,
    });
  });

  if (checks.length === 0 && response.passes) {
    checks.push({ id: 'qa-pass', name: 'QA Gesamtstatus', status: 'pass' });
  }

  return checks;
};

export const getWarningsFromChecks = (checks: QACheck[], response?: QAServiceResponse) => {
  if (response?.warnings && response.warnings.length > 0) {
    return response.warnings;
  }
  return checks
    .filter(check => check.status === 'warn')
    .map(check => check.message || check.name);
};

export const getQaStatus = (checks: QACheck[], response?: QAServiceResponse): QAStatus => {
  const hasFailure = checks.some(check => check.status === 'fail') || (response?.failures?.length ?? 0) > 0;
  const hasWarning = checks.some(check => check.status === 'warn') || (response?.warnings?.length ?? 0) > 0;

  if (hasFailure) return 'fail';
  if (hasWarning) return 'warn';
  if (checks.some(check => check.status === 'pass')) return 'pass';
  if (response?.passes === true) return 'pass';
  if (response?.passes === false) return 'fail';
  return 'pending';
};

import { useTranslation } from 'react-i18next';
import { CalendarClock, Sparkles } from 'lucide-react';
import type { Study } from '@/types/radiology';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDate } from '@/data/mockData';

interface PriorStudiesTimelineProps {
  currentStudy: Study;
  priorStudies: Study[];
}

interface MatchInfo {
  score: number;
  reasonKeys: string[];
}

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

const calculateMatch = (prior: Study, current: Study): MatchInfo => {
  const reasonKeys: string[] = [];
  let score = 0;

  if (prior.modality === current.modality) {
    score += 2;
    reasonKeys.push('sameModality');
  }

  const currentTokens = new Set(tokenize(current.studyDescription));
  const priorTokens = new Set(tokenize(prior.studyDescription));
  const overlap = Array.from(priorTokens).filter((token) => currentTokens.has(token));
  if (overlap.length > 0) {
    score += 1;
    reasonKeys.push('similarDescription');
  }

  if (prior.referringPhysician && prior.referringPhysician === current.referringPhysician) {
    score += 1;
    reasonKeys.push('sameReferrer');
  }

  const currentDate = Date.parse(current.studyDate);
  const priorDate = Date.parse(prior.studyDate);
  if (!Number.isNaN(currentDate) && !Number.isNaN(priorDate)) {
    const diffDays = Math.abs(currentDate - priorDate) / (1000 * 60 * 60 * 24);
    if (diffDays <= 365) {
      score += 1;
      reasonKeys.push('recent');
    }
  }

  return { score, reasonKeys };
};

const getStudyDateValue = (study: Study) => {
  const parsed = Date.parse(study.studyDate);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function PriorStudiesTimeline({ currentStudy, priorStudies }: PriorStudiesTimelineProps) {
  const { t } = useTranslation('common');
  const { t: tViewer } = useTranslation('viewer');
  
  const filtered = priorStudies.filter((study) => study.id !== currentStudy.id);
  const sorted = [...filtered].sort((a, b) => getStudyDateValue(b) - getStudyDateValue(a));
  const matches = sorted.map((study) => ({
    study,
    match: calculateMatch(study, currentStudy),
  }));
  const maxScore = matches.reduce((max, item) => Math.max(max, item.match.score), 0);
  const suggestionScore = maxScore >= 2 ? maxScore : null;

  const formatRelativeDate = (dateString: string) => {
    const value = Date.parse(dateString);
    if (Number.isNaN(value)) return '—';
    const diffDays = Math.floor((Date.now() - value) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return t('time.today');
    if (diffDays === 1) return t('time.yesterday');
    if (diffDays < 7) return t('time.daysAgo', { count: diffDays });
    if (diffDays < 31) return t('time.weeksAgo', { count: Math.round(diffDays / 7) });
    if (diffDays < 365) return t('time.monthsAgo', { count: Math.round(diffDays / 30) });
    return t('time.yearsAgo', { count: Math.round(diffDays / 365) });
  };

  const getReasonLabel = (key: string): string => {
    const labels: Record<string, string> = {
      sameModality: t('priorStudies.sameModality'),
      similarDescription: t('priorStudies.similarDescription'),
      sameReferrer: t('priorStudies.sameReferrer'),
      recent: t('priorStudies.recent'),
    };
    return labels[key] || key;
  };

  return (
    <div className="border-b border-sidebar-border shrink-0">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground">
          <CalendarClock className="h-4 w-4" />
          <span>{t('priorStudies.title')}</span>
        </div>
        <Badge variant="secondary" className="bg-primary/20 text-primary">
          {filtered.length}
        </Badge>
      </div>
      <div className="max-h-48 overflow-y-auto px-3 pb-3 space-y-2">
        {matches.length === 0 && (
          <div className="text-xs text-muted-foreground bg-sidebar-accent/40 rounded-lg px-3 py-2">
            {t('priorStudies.noPriors')}
          </div>
        )}
        {matches.map(({ study, match }) => {
          const isSuggested = suggestionScore !== null && match.score === suggestionScore;
          return (
            <div
              key={study.id}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                isSuggested ? 'border-primary/40 bg-sidebar-accent' : 'border-transparent hover:bg-sidebar-accent'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[10px] px-2">
                  {study.modality}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatDate(study.studyDate)}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-sidebar-foreground truncate">
                {study.studyDescription}
              </p>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="truncate">{study.accessionNumber}</span>
                <span>{formatRelativeDate(study.studyDate)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {isSuggested && (
                  <Badge variant="secondary" className="bg-primary/20 text-primary text-[10px] px-2 py-0">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {t('priorStudies.suggestion')}
                  </Badge>
                )}
                {match.reasonKeys.slice(0, 2).map((key) => (
                  <span
                    key={key}
                    className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5"
                  >
                    {getReasonLabel(key)}
                  </span>
                ))}
                <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                  {tViewer('series.count', { count: study.series.length })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

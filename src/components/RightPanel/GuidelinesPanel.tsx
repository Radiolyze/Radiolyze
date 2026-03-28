import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronDown, Search, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { guidelinesClient, type GuidelinePayload } from '@/services/guidelinesClient';

interface GuidelinesPanelProps {
  /** Pre-populate the search with findings context (e.g. extracted keywords). */
  findingsContext?: string;
  isOpenByDefault?: boolean;
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function GuidelineCard({ guideline }: { guideline: GuidelinePayload }) {
  const [expanded, setExpanded] = useState(false);
  const snippet = guideline.body.slice(0, 160);
  const hasMore = guideline.body.length > 160;

  return (
    <div className="rounded-lg border border-border bg-panel-secondary/40 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{guideline.title}</p>
          <p className="text-xs text-muted-foreground">{guideline.category}</p>
        </div>
        {guideline.source && (
          <Badge variant="outline" className="text-[10px] px-2 shrink-0">
            {guideline.source}
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {expanded ? guideline.body : snippet}
        {hasMore && !expanded && '…'}
      </p>

      {hasMore && (
        <button
          className="text-[10px] text-primary hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
        </button>
      )}

      {guideline.keywords && (
        <div className="flex flex-wrap gap-1">
          {guideline.keywords.split(',').map((kw) => kw.trim()).filter(Boolean).map((kw) => (
            <Badge key={kw} variant="secondary" className="text-[10px] px-1.5 py-0">
              {kw}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function GuidelinesPanel({
  findingsContext = '',
  isOpenByDefault = false,
}: GuidelinesPanelProps) {
  const { t } = useTranslation('report');
  const [isOpen, setIsOpen] = useState(isOpenByDefault);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GuidelinePayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const debouncedQuery = useDebounce(query, 350);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await guidelinesClient.search(q);
      setResults(data);
      setHasLoaded(true);
    } catch {
      setError('Leitlinien konnten nicht geladen werden.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger initial load when panel opens for the first time
  useEffect(() => {
    if (isOpen && !hasLoaded) {
      doSearch(findingsContext.slice(0, 100));
    }
  }, [isOpen, hasLoaded, findingsContext, doSearch]);

  // Re-search when debounced query changes
  useEffect(() => {
    if (isOpen && hasLoaded) {
      doSearch(debouncedQuery);
    }
  }, [debouncedQuery, isOpen, hasLoaded, doSearch]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="px-4 py-3 border-t border-border flex items-center justify-between hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="h-4 w-4" />
            <span>{t('guidelines.title', 'Leitlinien')}</span>
            {results.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                {results.length}
              </Badge>
            )}
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Leitlinien durchsuchen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {loading && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && hasLoaded && results.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Keine Leitlinien gefunden.
            </p>
          )}

          {/* Guideline cards */}
          {results.map((guideline) => (
            <GuidelineCard key={guideline.id} guideline={guideline} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

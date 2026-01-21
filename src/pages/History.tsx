import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  Edit3,
  Mic,
  Sparkles,
  AlertTriangle,
  Clock,
  Filter,
  Search,
  Download,
  User,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { auditClient, type AuditEventResponse } from '@/services/auditClient';

// Extended audit event type for display
interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  actorId?: string;
  actorName: string;
  reportId?: string;
  studyId?: string;
  patientName: string;
  accessionNumber: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

type AuditEventType =
  | 'report_created'
  | 'report_opened'
  | 'findings_saved'
  | 'impression_generated'
  | 'asr_transcription'
  | 'qa_check_run'
  | 'report_approved'
  | 'report_amended'
  | 'report_exported'
  | 'inference_queued'
  | 'other';

const eventTypeConfig: Record<AuditEventType, {
  icon: typeof FileText;
  label: string;
  color: string;
  bgColor: string;
}> = {
  report_created: { icon: FileText, label: 'Report erstellt', color: 'text-primary', bgColor: 'bg-primary/10' },
  report_opened: { icon: FileText, label: 'Report geöffnet', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  findings_saved: { icon: Edit3, label: 'Befund gespeichert', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  impression_generated: { icon: Sparkles, label: 'KI-Beurteilung generiert', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  asr_transcription: { icon: Mic, label: 'Diktat transkribiert', color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  qa_check_run: { icon: AlertTriangle, label: 'QA-Prüfung', color: 'text-warning', bgColor: 'bg-warning/10' },
  report_approved: { icon: CheckCircle, label: 'Report freigegeben', color: 'text-success', bgColor: 'bg-success/10' },
  report_amended: { icon: Edit3, label: 'Report korrigiert', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  report_exported: { icon: Download, label: 'Report exportiert', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  inference_queued: { icon: Sparkles, label: 'KI in Queue', color: 'text-info', bgColor: 'bg-info/10' },
  other: { icon: FileText, label: 'Ereignis', color: 'text-muted-foreground', bgColor: 'bg-muted' },
};

const knownEventTypes = new Set<AuditEventType>([
  'report_created',
  'report_opened',
  'findings_saved',
  'impression_generated',
  'asr_transcription',
  'qa_check_run',
  'report_approved',
  'report_amended',
  'report_exported',
  'inference_queued',
]);

const resolveEventType = (eventType: string): AuditEventType =>
  knownEventTypes.has(eventType as AuditEventType) ? (eventType as AuditEventType) : 'other';

const getMetadataRecord = (metadata?: Record<string, unknown> | null) =>
  metadata && typeof metadata === 'object' ? metadata : {};

const getMetadataString = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
};

const buildFallbackLabel = (label: string, id?: string | null) =>
  id ? `${label} ${id.slice(0, 8)}...` : '';

const resolveActorName = (event: AuditEventResponse) => {
  const metadata = getMetadataRecord(event.metadata);
  return (
    getMetadataString(metadata, 'actor_name') ||
    getMetadataString(metadata, 'signature') ||
    getMetadataString(metadata, 'approved_by') ||
    event.actor_id ||
    'System'
  );
};

const resolvePatientName = (event: AuditEventResponse) => {
  const metadata = getMetadataRecord(event.metadata);
  const patientName = getMetadataString(metadata, 'patient_name');
  if (patientName) return patientName;

  const studyFallback = buildFallbackLabel('Studie', event.study_id);
  if (studyFallback) return studyFallback;

  const reportFallback = buildFallbackLabel('Report', event.report_id);
  if (reportFallback) return reportFallback;

  return 'Unbekannt';
};

const resolveAccessionNumber = (event: AuditEventResponse) => {
  const metadata = getMetadataRecord(event.metadata);
  const accession = getMetadataString(metadata, 'accession_number');
  if (accession) return accession;
  if (event.study_id) return event.study_id.slice(0, 12);
  if (event.report_id) return event.report_id.slice(0, 12);
  return '—';
};

const mapAuditEventToEntry = (event: AuditEventResponse): AuditLogEntry => ({
  id: event.id,
  eventType: resolveEventType(event.event_type),
  actorId: event.actor_id ?? undefined,
  actorName: resolveActorName(event),
  reportId: event.report_id ?? undefined,
  studyId: event.study_id ?? undefined,
  patientName: resolvePatientName(event),
  accessionNumber: resolveAccessionNumber(event),
  timestamp: event.timestamp,
  metadata: event.metadata ?? undefined,
});

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `vor ${diffMins} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return date.toLocaleDateString('de-DE');
}

function formatFullDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function groupByDate(entries: AuditLogEntry[]): Map<string, AuditLogEntry[]> {
  const groups = new Map<string, AuditLogEntry[]>();
  
  entries.forEach((entry) => {
    const date = new Date(entry.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = 'Heute';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Gestern';
    } else {
      key = date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(entry);
  });

  return groups;
}

export default function History() {
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadAuditLog = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await auditClient.listEvents();
        if (!isActive) return;
        setAuditEntries(response.map(mapAuditEventToEntry));
      } catch (error) {
        console.warn('Failed to load audit log', error);
        if (isActive) {
          setErrorMessage('Audit Log konnte nicht geladen werden.');
          setAuditEntries([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadAuditLog();
    return () => {
      isActive = false;
    };
  }, []);

  // Get unique actors for filter
  const uniqueActors = useMemo(() => {
    const actors = new Set(auditEntries.map((e) => e.actorName).filter(Boolean));
    return Array.from(actors);
  }, [auditEntries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return auditEntries.filter((entry) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const fields = [
          entry.patientName,
          entry.accessionNumber,
          entry.reportId ?? '',
          entry.studyId ?? '',
          entry.actorName,
          entry.actorId ?? '',
        ];
        const matchesSearch = fields.some((value) => value.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Event type filter
      if (eventFilter !== 'all' && entry.eventType !== eventFilter) {
        return false;
      }

      // Actor filter
      if (actorFilter !== 'all' && entry.actorName !== actorFilter) {
        return false;
      }

      return true;
    });
  }, [auditEntries, searchQuery, eventFilter, actorFilter]);

  // Group by date
  const groupedEntries = useMemo(() => groupByDate(filteredEntries), [filteredEntries]);

  // Stats
  const todayCount = auditEntries.filter((e) => {
    const date = new Date(e.timestamp);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }).length;

  const approvedCount = auditEntries.filter((e) => e.eventType === 'report_approved').length;
  const impressionCount = auditEntries.filter((e) => e.eventType === 'impression_generated').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Report-Historie</h1>
        <Badge variant="outline" className="ml-2">
          Audit Log
        </Badge>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{todayCount}</p>
                  <p className="text-sm text-muted-foreground">Ereignisse heute</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvedCount}</p>
                  <p className="text-sm text-muted-foreground">Reports freigegeben</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {impressionCount}
                  </p>
                  <p className="text-sm text-muted-foreground">KI-Beurteilungen</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suche nach Patient, Accession, Report..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Ereignistyp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Ereignisse</SelectItem>
                  {Object.entries(eventTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actorFilter} onValueChange={setActorFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Benutzer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Benutzer</SelectItem>
                  {uniqueActors.map((actor) => (
                    <SelectItem key={actor} value={actor}>
                      {actor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Timeline
              </span>
              <Badge variant="secondary">{filteredEntries.length} Einträge</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="p-6 pt-0">
                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Audit Log wird geladen</p>
                    <p className="text-sm mt-1">Bitte warten...</p>
                  </div>
                ) : errorMessage ? (
                  <div className="text-center py-12 text-destructive">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-70" />
                    <p>{errorMessage}</p>
                  </div>
                ) : (
                  <>
                    {Array.from(groupedEntries.entries()).map(([dateLabel, entries]) => (
                      <div key={dateLabel} className="mb-6">
                        {/* Date Header */}
                        <div className="sticky top-0 bg-card z-10 py-2 mb-3">
                          <h3 className="text-sm font-semibold text-muted-foreground">{dateLabel}</h3>
                          <Separator className="mt-2" />
                        </div>

                        {/* Timeline Items */}
                        <div className="relative pl-8">
                          {/* Timeline Line */}
                          <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

                          {entries.map((entry) => {
                            const config = eventTypeConfig[entry.eventType];
                            const Icon = config.icon;

                            return (
                              <div
                                key={entry.id}
                                className="relative mb-4 last:mb-0"
                              >
                                {/* Timeline Dot */}
                                <div
                                  className={cn(
                                    'absolute -left-5 w-6 h-6 rounded-full flex items-center justify-center',
                                    config.bgColor
                                  )}
                                >
                                  <Icon className={cn('h-3 w-3', config.color)} />
                                </div>

                                {/* Content */}
                                <div className="bg-accent/30 rounded-lg p-4 hover:bg-accent/50 transition-colors">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={cn('font-medium', config.color)}>
                                          {config.label}
                                        </span>
                                        <Badge variant="outline" className="text-xs">
                                          {entry.accessionNumber}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-foreground">
                                        {entry.patientName}
                                      </p>
                                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          {entry.actorName}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {formatRelativeTime(entry.timestamp)}
                                        </span>
                                      </div>
                                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                                        <div className="mt-2 text-xs text-muted-foreground bg-background/50 rounded px-2 py-1">
                                          {Object.entries(entry.metadata).map(([key, value]) => (
                                            <span key={key} className="mr-3">
                                              <span className="font-medium">{key}:</span>{' '}
                                              {String(value)}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                                      {formatFullDateTime(entry.timestamp)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {filteredEntries.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Keine Ereignisse gefunden</p>
                        <p className="text-sm mt-1">Passen Sie die Filter an</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
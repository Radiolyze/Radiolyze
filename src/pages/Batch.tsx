import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  AlertTriangle,
  BarChart3,
  Filter,
  Search,
  CheckSquare,
  Square,
  Trash2,
  Send,
  Download,
  RefreshCw,
  Users,
  TrendingUp,
  Timer,
  XCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useWebSocket, ReportStatusEvent } from '@/hooks/useWebSocket';
import type { ReportStatus, QAStatus } from '@/types/radiology';
import { reportClient, type ReportResponsePayload } from '@/services/reportClient';
import { mapReportResponse } from '@/services/reportMapping';
import { useStudyLookup } from '@/hooks/useStudyLookup';

interface BatchReport {
  id: string;
  patientName: string;
  mrn: string;
  accessionNumber: string;
  modality: string;
  studyDescription: string;
  studyDate: string;
  status: ReportStatus;
  qaStatus: QAStatus;
  assignedTo: string;
  priority: 'normal' | 'urgent' | 'stat';
  createdAt: string;
  turnaroundMinutes?: number;
}

const resolveTurnaroundMinutes = (createdAt: string, updatedAt: string) => {
  const created = Date.parse(createdAt);
  const updated = Date.parse(updatedAt);
  if (Number.isNaN(created) || Number.isNaN(updated)) return undefined;
  const diffMinutes = Math.round((updated - created) / 60000);
  return diffMinutes > 0 ? diffMinutes : undefined;
};

export default function Batch() {
  const { t } = useTranslation('batch');
  const { t: tCommon } = useTranslation('common');
  const { t: tReport } = useTranslation('report');
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalityFilter, setModalityFilter] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [reports, setReports] = useState<BatchReport[]>([]);
  const [reportPayloads, setReportPayloads] = useState<ReportResponsePayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusConfig: Record<ReportStatus, { label: string; color: string; icon: typeof FileText }> = {
    pending: { label: tCommon('status.pending'), color: 'bg-muted text-muted-foreground', icon: Clock },
    in_progress: { label: tCommon('status.inProgress'), color: 'bg-blue-500/10 text-blue-500', icon: RefreshCw },
    draft: { label: tCommon('status.draft'), color: 'bg-warning/10 text-warning', icon: FileText },
    approved: { label: tCommon('status.approved'), color: 'bg-success/10 text-success', icon: CheckCircle },
    finalized: { label: tCommon('status.finalized'), color: 'bg-primary/10 text-primary', icon: CheckCircle },
  };

  const qaStatusConfig: Record<QAStatus, { label: string; color: string }> = {
    pending: { label: tCommon('status.pending'), color: 'text-muted-foreground' },
    checking: { label: tReport('qa.checking'), color: 'text-blue-500' },
    pass: { label: tReport('qa.passed'), color: 'text-success' },
    warn: { label: tReport('qa.warning'), color: 'text-warning' },
    fail: { label: tReport('qa.failed'), color: 'text-destructive' },
  };

  const priorityConfig = {
    normal: { label: tCommon('priority.normal'), color: 'bg-muted text-muted-foreground' },
    urgent: { label: tCommon('priority.urgent'), color: 'bg-warning/10 text-warning border-warning' },
    stat: { label: tCommon('priority.stat'), color: 'bg-destructive/10 text-destructive border-destructive' },
  };

  const studyIds = useMemo(
    () => Array.from(new Set((Array.isArray(reportPayloads) ? reportPayloads : []).map((report) => report.study_id).filter(Boolean))),
    [reportPayloads]
  );
  const { studyMap, error: studyLookupError } = useStudyLookup(studyIds);

  useEffect(() => {
    if (studyLookupError) {
      toast.error(studyLookupError);
    }
  }, [studyLookupError]);

  useEffect(() => {
    let isActive = true;

    const loadReports = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await reportClient.listReports({ limit: 200 });
        if (!isActive) return;
        setReportPayloads(Array.isArray(response) ? response : []);
      } catch (error) {
        console.warn('Failed to load reports', error);
        if (isActive) {
          setErrorMessage(t('table.loading'));
          setReportPayloads([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadReports();

    return () => {
      isActive = false;
    };
  }, [t]);

  const mappedReports = useMemo(() => {
    const safePayloads = Array.isArray(reportPayloads) ? reportPayloads : [];
    return safePayloads.map((payload) => {
      const report = mapReportResponse(payload);
      const study = studyMap[report.studyId];
      const fallbackAccession = report.studyId ? report.studyId.slice(0, 8) : '—';

      return {
        id: report.id,
        patientName: study?.patientName ?? `Report ${report.id.slice(0, 8)}...`,
        mrn: study?.mrn ?? report.patientId,
        accessionNumber: study?.accessionNumber ?? fallbackAccession,
        modality: study?.modality ?? 'CT',
        studyDescription: study?.studyDescription ?? tCommon('study.study'),
        studyDate: study?.studyDate ?? report.createdAt.slice(0, 10),
        status: report.status,
        qaStatus: report.qaStatus,
        assignedTo: report.approvedBy ?? '-',
        priority: 'normal' as const,
        createdAt: report.createdAt,
        turnaroundMinutes: resolveTurnaroundMinutes(report.createdAt, report.updatedAt),
      };
    });
  }, [reportPayloads, studyMap, tCommon]);

  useEffect(() => {
    if (mappedReports.length === 0) {
      if (!isLoading) {
        setReports([]);
      }
      return;
    }

    setReports((prev) => {
      if (prev.length === 0) return mappedReports;
      const prevMap = new Map(prev.map((report) => [report.id, report]));
      return mappedReports.map((report) => {
        const existing = prevMap.get(report.id);
        if (!existing) return report;
        return {
          ...report,
          qaStatus: existing.qaStatus ?? report.qaStatus,
        };
      });
    });
  }, [mappedReports, isLoading]);

  // WebSocket live updates
  const handleReportStatus = useCallback((event: ReportStatusEvent) => {
    const { reportId, payload } = event;
    
    setReports(prev => prev.map(report => {
      if (report.id !== reportId) return report;
      return {
        ...report,
        qaStatus: payload.qaStatus || report.qaStatus,
      };
    }));

    // Show toast for QA status changes
    if (payload.qaStatus === 'fail') {
      toast.error(`Report ${reportId.slice(0, 8)}... ${tReport('qa.failed')}`);
    } else if (payload.qaStatus === 'pass') {
      toast.success(`Report ${reportId.slice(0, 8)}... ${tReport('qa.passed')}`);
    }
  }, [tReport]);

  const { isConnected: wsConnected } = useWebSocket({
    onReportStatus: handleReportStatus,
  });

  // Filter reports - use live reports state
  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches =
          report.patientName.toLowerCase().includes(query) ||
          report.accessionNumber.toLowerCase().includes(query) ||
          report.mrn.toLowerCase().includes(query);
        if (!matches) return false;
      }

      if (statusFilter !== 'all' && report.status !== statusFilter) {
        return false;
      }

      if (modalityFilter !== 'all' && report.modality !== modalityFilter) {
        return false;
      }

      return true;
    });
  }, [searchQuery, statusFilter, modalityFilter, reports]);

  // Stats - use live reports
  const stats = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter((r) => r.status === 'pending').length;
    const drafts = reports.filter((r) => r.status === 'draft').length;
    const approved = reports.filter((r) => r.status === 'approved' || r.status === 'finalized').length;
    const avgTurnaround = reports
      .filter((r) => r.turnaroundMinutes !== undefined)
      .reduce((acc, r) => acc + (r.turnaroundMinutes || 0), 0) /
      (reports.filter((r) => r.turnaroundMinutes !== undefined).length || 1);
    const qaWarnings = reports.filter((r) => r.qaStatus === 'warn' || r.qaStatus === 'fail').length;

    return { total, pending, drafts, approved, avgTurnaround: Math.round(avgTurnaround), qaWarnings };
  }, [reports]);

  // Unique modalities for filter
  const modalities = useMemo(() => {
    return Array.from(new Set(reports.map((r) => r.modality)));
  }, [reports]);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredReports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReports.map((r) => r.id)));
    }
  }, [filteredReports, selectedIds.size]);

  const handleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Bulk actions
  const handleBulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsProcessing(true);
    setProcessProgress(0);

    const total = selectedIds.size;
    let processed = 0;
    let approved = 0;
    let failed = 0;

    for (const id of selectedIds) {
      const report = reports.find((item) => item.id === id);
      if (!report || report.status !== 'draft' || report.qaStatus !== 'pass') {
        processed++;
        setProcessProgress((processed / total) * 100);
        continue;
      }

      try {
        const response = await reportClient.finalizeReport(id, 'Batch');
        const updated = mapReportResponse(response);
        approved++;
        setReports((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: updated.status,
                  qaStatus: updated.qaStatus,
                  assignedTo: updated.approvedBy ?? item.assignedTo,
                  turnaroundMinutes: resolveTurnaroundMinutes(updated.createdAt, updated.updatedAt),
                }
              : item
          )
        );
      } catch (error) {
        console.warn('Failed to finalize report', error);
        failed++;
      } finally {
        processed++;
        setProcessProgress((processed / total) * 100);
      }
    }

    setIsProcessing(false);
    setProcessProgress(0);
    setSelectedIds(new Set());

    if (approved > 0) {
      toast.success(t('bulk.completed', { count: approved }));
    }
    if (failed > 0) {
      toast.error(t('bulk.failed', { count: failed }));
    }
  }, [reports, selectedIds, t]);

  const handleBulkExport = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    setProcessProgress(0);

    const ids = Array.from(selectedIds);
    const total = ids.length;
    let processed = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        const result = await reportClient.exportStructuredReport(id, 'dicom');
        const url = URL.createObjectURL(result.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.fileName;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn('Bulk export failed', error);
        failed++;
      } finally {
        processed++;
        setProcessProgress((processed / total) * 100);
      }
    }

    setIsProcessing(false);
    setProcessProgress(0);
    setSelectedIds(new Set());

    if (failed === 0) {
      toast.success(tReport('export.success'));
    } else {
      toast.error(t('bulk.failed', { count: failed }));
    }
  }, [selectedIds, t, tReport]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    toast.error(tCommon('status.error'));
  }, [selectedIds, tCommon]);

  const isAllSelected = filteredReports.length > 0 && selectedIds.size === filteredReports.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredReports.length;

  // Get approvable reports (drafts with passing QA)
  const approvableSelected = useMemo(() => {
    return filteredReports.filter(
      (r) => selectedIds.has(r.id) && r.status === 'draft' && r.qaStatus === 'pass'
    ).length;
  }, [filteredReports, selectedIds]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <Badge variant="outline" className="ml-2">
          <BarChart3 className="h-3 w-3 mr-1" />
          Dashboard
        </Badge>
        
        {/* WebSocket connection status */}
        <div className="ml-auto flex items-center gap-2 text-xs">
          {wsConnected ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-success" />
              <span className="text-success hidden sm:inline">{tCommon('connection.liveUpdates')}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground hidden sm:inline">{tCommon('connection.connecting')}</span>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t('stats.total')}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                <span className="text-sm text-muted-foreground">{t('stats.pending')}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">{t('stats.drafts')}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.drafts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-sm text-muted-foreground">{t('stats.approved')}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.approved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Ø TAT</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.avgTurnaround} min</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-muted-foreground">QA Issues</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.qaWarnings}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Actions Bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('filters.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t('filters.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
                  <SelectItem value="pending">{tCommon('status.pending')}</SelectItem>
                  <SelectItem value="in_progress">{tCommon('status.inProgress')}</SelectItem>
                  <SelectItem value="draft">{tCommon('status.draft')}</SelectItem>
                  <SelectItem value="approved">{tCommon('status.approved')}</SelectItem>
                  <SelectItem value="finalized">{tCommon('status.finalized')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Modality Filter */}
              <Select value={modalityFilter} onValueChange={setModalityFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder={t('filters.modality')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allModalities')}</SelectItem>
                  {modalities.map((mod) => (
                    <SelectItem key={mod} value={mod}>
                      {mod}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Bulk Actions */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <Badge variant="secondary">
                    {t('actions.selected', { count: selectedIds.size })}
                  </Badge>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={approvableSelected === 0}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        {tCommon('actions.approve')} ({approvableSelected})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('bulk.confirmApprove', { count: approvableSelected })}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('bulk.confirmApprove', { count: approvableSelected })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkApprove}>
                          {tCommon('actions.approve')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button variant="outline" size="sm" onClick={handleBulkExport}>
                    <Download className="h-4 w-4 mr-1" />
                    {tCommon('actions.export')}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-1" />
                        {tCommon('actions.delete')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{tCommon('actions.delete')}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {selectedIds.size} Reports werden dauerhaft gelöscht.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleBulkDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {tCommon('actions.delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>

            {/* Processing Progress */}
            {isProcessing && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{t('bulk.processing', { current: Math.round(processProgress), total: 100 })}</span>
                  <span className="font-mono">{Math.round(processProgress)}%</span>
                </div>
                <Progress value={processProgress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>Reports</span>
              <Badge variant="outline">{filteredReports.length} {t('table.noResults').includes('Ergebnisse') ? 'Einträge' : 'entries'}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        // @ts-ignore - indeterminate is valid
                        indeterminate={isSomeSelected}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>{t('table.patient')}</TableHead>
                    <TableHead>Accession</TableHead>
                    <TableHead>{t('table.study')}</TableHead>
                    <TableHead>{t('table.status')}</TableHead>
                    <TableHead>QA</TableHead>
                    <TableHead>{t('table.priority')}</TableHead>
                    <TableHead>-</TableHead>
                    <TableHead className="text-right">TAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin" />
                        <p>{t('table.loading')}</p>
                      </TableCell>
                    </TableRow>
                  )}
                  {errorMessage && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-destructive">
                        <XCircle className="h-8 w-8 mx-auto mb-3" />
                        <p>{errorMessage}</p>
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredReports.map((report) => {
                    const statusConf = statusConfig[report.status];
                    const qaConf = qaStatusConfig[report.qaStatus];
                    const priorityConf = priorityConfig[report.priority];
                    const isSelected = selectedIds.has(report.id);

                    return (
                      <TableRow
                        key={report.id}
                        className={cn(
                          'cursor-pointer',
                          isSelected && 'bg-accent'
                        )}
                        onClick={() => handleSelectOne(report.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleSelectOne(report.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{report.patientName}</p>
                            <p className="text-xs text-muted-foreground">{report.mrn}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {report.accessionNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{report.studyDescription}</p>
                            <p className="text-xs text-muted-foreground">
                              {report.modality} • {report.studyDate}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConf.color}>
                            {statusConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-sm font-medium', qaConf.color)}>
                            {qaConf.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(priorityConf.color, 'text-xs')}
                          >
                            {priorityConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {report.assignedTo}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {report.turnaroundMinutes ? `${report.turnaroundMinutes}m` : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredReports.length === 0 && !isLoading && !errorMessage && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-muted-foreground">{t('table.noResults')}</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

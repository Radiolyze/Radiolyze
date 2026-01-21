import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

// Mock batch reports data
const mockBatchReports: BatchReport[] = [
  {
    id: 'r1',
    patientName: 'Schmidt, Hans',
    mrn: 'MRN-001234',
    accessionNumber: 'ACC-2024-00001',
    modality: 'CT',
    studyDescription: 'CT Thorax mit KM',
    studyDate: '2024-01-19',
    status: 'draft',
    qaStatus: 'pass',
    assignedTo: 'Dr. Müller',
    priority: 'normal',
    createdAt: '2024-01-19T08:30:00Z',
    turnaroundMinutes: 45,
  },
  {
    id: 'r2',
    patientName: 'Weber, Maria',
    mrn: 'MRN-001235',
    accessionNumber: 'ACC-2024-00002',
    modality: 'MR',
    studyDescription: 'MRT Schädel',
    studyDate: '2024-01-19',
    status: 'draft',
    qaStatus: 'pass',
    assignedTo: 'Dr. Müller',
    priority: 'urgent',
    createdAt: '2024-01-19T09:15:00Z',
    turnaroundMinutes: 32,
  },
  {
    id: 'r3',
    patientName: 'Fischer, Peter',
    mrn: 'MRN-001236',
    accessionNumber: 'ACC-2024-00003',
    modality: 'CR',
    studyDescription: 'Röntgen Thorax',
    studyDate: '2024-01-19',
    status: 'approved',
    qaStatus: 'pass',
    assignedTo: 'Dr. Bauer',
    priority: 'normal',
    createdAt: '2024-01-19T07:45:00Z',
    turnaroundMinutes: 15,
  },
  {
    id: 'r4',
    patientName: 'Hoffmann, Klaus',
    mrn: 'MRN-001237',
    accessionNumber: 'ACC-2024-00004',
    modality: 'CT',
    studyDescription: 'CT Abdomen',
    studyDate: '2024-01-19',
    status: 'in_progress',
    qaStatus: 'warn',
    assignedTo: 'Dr. Müller',
    priority: 'stat',
    createdAt: '2024-01-19T10:00:00Z',
  },
  {
    id: 'r5',
    patientName: 'Schneider, Anna',
    mrn: 'MRN-001238',
    accessionNumber: 'ACC-2024-00005',
    modality: 'US',
    studyDescription: 'Sono Abdomen',
    studyDate: '2024-01-19',
    status: 'pending',
    qaStatus: 'pending',
    assignedTo: 'Unzugewiesen',
    priority: 'normal',
    createdAt: '2024-01-19T10:30:00Z',
  },
  {
    id: 'r6',
    patientName: 'Braun, Michael',
    mrn: 'MRN-001239',
    accessionNumber: 'ACC-2024-00006',
    modality: 'CT',
    studyDescription: 'CT Kopf nativ',
    studyDate: '2024-01-19',
    status: 'draft',
    qaStatus: 'fail',
    assignedTo: 'Dr. Bauer',
    priority: 'urgent',
    createdAt: '2024-01-19T11:00:00Z',
    turnaroundMinutes: 28,
  },
  {
    id: 'r7',
    patientName: 'Klein, Sophie',
    mrn: 'MRN-001240',
    accessionNumber: 'ACC-2024-00007',
    modality: 'MR',
    studyDescription: 'MRT Wirbelsäule',
    studyDate: '2024-01-19',
    status: 'draft',
    qaStatus: 'pass',
    assignedTo: 'Dr. Müller',
    priority: 'normal',
    createdAt: '2024-01-19T11:30:00Z',
    turnaroundMinutes: 55,
  },
  {
    id: 'r8',
    patientName: 'Zimmermann, Paul',
    mrn: 'MRN-001241',
    accessionNumber: 'ACC-2024-00008',
    modality: 'CR',
    studyDescription: 'Röntgen Hand',
    studyDate: '2024-01-19',
    status: 'finalized',
    qaStatus: 'pass',
    assignedTo: 'Dr. Bauer',
    priority: 'normal',
    createdAt: '2024-01-19T06:00:00Z',
    turnaroundMinutes: 8,
  },
];

const statusConfig: Record<ReportStatus, { label: string; color: string; icon: typeof FileText }> = {
  pending: { label: 'Ausstehend', color: 'bg-muted text-muted-foreground', icon: Clock },
  in_progress: { label: 'In Bearbeitung', color: 'bg-blue-500/10 text-blue-500', icon: RefreshCw },
  draft: { label: 'Entwurf', color: 'bg-warning/10 text-warning', icon: FileText },
  approved: { label: 'Freigegeben', color: 'bg-success/10 text-success', icon: CheckCircle },
  finalized: { label: 'Finalisiert', color: 'bg-primary/10 text-primary', icon: CheckCircle },
};

const qaStatusConfig: Record<QAStatus, { label: string; color: string }> = {
  pending: { label: 'Ausstehend', color: 'text-muted-foreground' },
  checking: { label: 'Prüfung...', color: 'text-blue-500' },
  pass: { label: 'OK', color: 'text-success' },
  warn: { label: 'Warnung', color: 'text-warning' },
  fail: { label: 'Fehler', color: 'text-destructive' },
};

const priorityConfig = {
  normal: { label: 'Normal', color: 'bg-muted text-muted-foreground' },
  urgent: { label: 'Dringend', color: 'bg-warning/10 text-warning border-warning' },
  stat: { label: 'STAT', color: 'bg-destructive/10 text-destructive border-destructive' },
};

export default function Batch() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalityFilter, setModalityFilter] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [reports, setReports] = useState(mockBatchReports);

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
      toast.error(`Report ${reportId.slice(0, 8)}... QA fehlgeschlagen`);
    } else if (payload.qaStatus === 'pass') {
      toast.success(`Report ${reportId.slice(0, 8)}... QA bestanden`);
    }
  }, []);

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
      .filter((r) => r.turnaroundMinutes)
      .reduce((acc, r) => acc + (r.turnaroundMinutes || 0), 0) / 
      reports.filter((r) => r.turnaroundMinutes).length || 0;
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

    for (const id of selectedIds) {
      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      processed++;
      setProcessProgress((processed / total) * 100);
    }

    setIsProcessing(false);
    setProcessProgress(0);
    setSelectedIds(new Set());
    toast.success(`${total} Reports wurden freigegeben`);
  }, [selectedIds]);

  const handleBulkExport = useCallback(() => {
    if (selectedIds.size === 0) return;
    toast.success(`${selectedIds.size} Reports werden exportiert...`);
    // Simulated export
    setTimeout(() => {
      toast.success('Export abgeschlossen');
    }, 1500);
  }, [selectedIds]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} Reports wurden gelöscht`);
  }, [selectedIds]);

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
        <h1 className="text-lg font-semibold">Batch-Reporting</h1>
        <Badge variant="outline" className="ml-2">
          <BarChart3 className="h-3 w-3 mr-1" />
          Dashboard
        </Badge>
        
        {/* WebSocket connection status */}
        <div className="ml-auto flex items-center gap-2 text-xs">
          {wsConnected ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-success" />
              <span className="text-success hidden sm:inline">Live-Updates</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground hidden sm:inline">Verbinden...</span>
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
                <span className="text-sm text-muted-foreground">Gesamt</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                <span className="text-sm text-muted-foreground">Ausstehend</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Entwürfe</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.drafts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-sm text-muted-foreground">Freigegeben</span>
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
                    placeholder="Suche nach Patient, Accession, MRN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="pending">Ausstehend</SelectItem>
                  <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                  <SelectItem value="draft">Entwurf</SelectItem>
                  <SelectItem value="approved">Freigegeben</SelectItem>
                  <SelectItem value="finalized">Finalisiert</SelectItem>
                </SelectContent>
              </Select>

              {/* Modality Filter */}
              <Select value={modalityFilter} onValueChange={setModalityFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Modalität" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
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
                    {selectedIds.size} ausgewählt
                  </Badge>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={approvableSelected === 0}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Freigeben ({approvableSelected})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reports freigeben?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {approvableSelected} Reports werden freigegeben. 
                          Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkApprove}>
                          Freigeben
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button variant="outline" size="sm" onClick={handleBulkExport}>
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Löschen
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reports löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {selectedIds.size} Reports werden dauerhaft gelöscht.
                          Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleBulkDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Löschen
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
                  <span className="text-muted-foreground">Verarbeite Reports...</span>
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
              <Badge variant="outline">{filteredReports.length} Einträge</Badge>
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
                    <TableHead>Patient</TableHead>
                    <TableHead>Accession</TableHead>
                    <TableHead>Studie</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>QA</TableHead>
                    <TableHead>Priorität</TableHead>
                    <TableHead>Zugewiesen</TableHead>
                    <TableHead className="text-right">TAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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

                  {filteredReports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-muted-foreground">Keine Reports gefunden</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Passen Sie die Filter an
                        </p>
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
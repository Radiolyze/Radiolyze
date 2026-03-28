import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Minus,
  Save,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { monitoringClient, type DriftReport, type DriftSnapshot } from '@/services/monitoringClient';
import { cn } from '@/lib/utils';

function fmt(value: number | null | undefined, decimals = 3): string {
  if (value == null) return '—';
  return value.toFixed(decimals);
}

function fmtPct(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)} %`;
}

function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (delta == null) return <span className="text-muted-foreground">—</span>;
  const abs = Math.abs(delta);
  if (abs < 0.001) return (
    <Badge variant="outline" className="gap-1 text-xs">
      <Minus className="h-3 w-3" /> {fmt(delta)}
    </Badge>
  );
  if (delta > 0) return (
    <Badge variant="default" className="gap-1 text-xs bg-green-600">
      <TrendingUp className="h-3 w-3" /> +{fmt(delta)}
    </Badge>
  );
  return (
    <Badge variant="destructive" className="gap-1 text-xs">
      <TrendingDown className="h-3 w-3" /> {fmt(delta)}
    </Badge>
  );
}

function MetricRow({
  label,
  current,
  baseline,
  delta,
  format = fmt,
}: {
  label: string;
  current: number | null | undefined;
  baseline: number | null | undefined;
  delta: number | null | undefined;
  format?: (v: number | null | undefined) => string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-4">
        <span className="w-20 text-right font-mono">{format(baseline)}</span>
        <span className="w-20 text-right font-mono font-medium">{format(current)}</span>
        <div className="w-24 text-right">
          <DeltaBadge delta={delta} />
        </div>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: { metric: string; delta: number; threshold: number } }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
      <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
      <div className="text-sm">
        <span className="font-medium text-yellow-300">{alert.metric}</span>
        <span className="text-muted-foreground ml-2">
          delta {alert.delta > 0 ? '+' : ''}{fmt(alert.delta)} (threshold ±{fmt(alert.threshold)})
        </span>
      </div>
    </div>
  );
}

function SnapshotChart({ snapshots }: { snapshots: DriftSnapshot[] }) {
  const data = [...snapshots]
    .reverse()
    .map((s) => ({
      date: new Date(s.created_at).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }),
      confidence: s.payload.current.inference.confidence_avg,
      passRate: s.payload.current.qa.pass_rate != null ? s.payload.current.qa.pass_rate * 100 : null,
      alerts: s.payload.alerts.length,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Keine Snapshots vorhanden. Klicke auf &ldquo;Snapshot speichern&rdquo;, um Verlaufsdaten zu erzeugen.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground mb-2">Ø Konfidenz (Inferenz)</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, 'Konfidenz']} />
            <ReferenceLine y={0.7} stroke="hsl(var(--warning))" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="confidence"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">QA Pass-Rate (%)</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Pass-Rate']} />
            <ReferenceLine y={80} stroke="hsl(var(--warning))" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="passRate"
              stroke="hsl(var(--success, 34 197 94))"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Monitoring() {
  const [windowDays, setWindowDays] = useState(7);
  const [saving, setSaving] = useState(false);

  const {
    data: drift,
    isLoading,
    error,
    refetch,
  } = useQuery<DriftReport>({
    queryKey: ['drift', windowDays],
    queryFn: () => monitoringClient.getDriftReport(windowDays),
  });

  const { data: snapshots = [], refetch: refetchSnapshots } = useQuery<DriftSnapshot[]>({
    queryKey: ['drift-snapshots'],
    queryFn: () => monitoringClient.listDriftSnapshots(30),
  });

  async function handleSaveSnapshot() {
    setSaving(true);
    try {
      await monitoringClient.getDriftReport(windowDays, undefined, true);
      await refetchSnapshots();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Drift-Monitoring</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={String(windowDays)}
            onValueChange={(v) => setWindowDays(Number(v))}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Letzte 3 Tage</SelectItem>
              <SelectItem value="7">Letzte 7 Tage</SelectItem>
              <SelectItem value="14">Letzte 14 Tage</SelectItem>
              <SelectItem value="30">Letzte 30 Tage</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            Aktualisieren
          </Button>
          <Button size="sm" className="gap-2" onClick={handleSaveSnapshot} disabled={saving}>
            <Save className="h-4 w-4" />
            Snapshot speichern
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Alerts */}
        {!isLoading && drift && drift.alerts.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Aktive Drift-Warnungen ({drift.alerts.length})
            </h2>
            {drift.alerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} />
            ))}
          </div>
        )}

        {!isLoading && drift && drift.alerts.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
            Kein Drift detektiert im aktuellen Zeitfenster.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inferenz-Metriken */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Inferenz-Metriken</CardTitle>
              <p className="text-xs text-muted-foreground">
                Zeitfenster vs. Baseline
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : error ? (
                <p className="text-sm text-destructive">Fehler beim Laden.</p>
              ) : drift ? (
                <div>
                  <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                    <span />
                    <div className="flex gap-4">
                      <span className="w-20 text-right">Baseline</span>
                      <span className="w-20 text-right">Aktuell</span>
                      <span className="w-24 text-right">Delta</span>
                    </div>
                  </div>
                  <MetricRow
                    label="Anzahl Jobs"
                    current={drift.current.inference.count}
                    baseline={drift.baseline.inference.count}
                    delta={null}
                    format={(v) => v == null ? '—' : String(v)}
                  />
                  <MetricRow
                    label="Ø Konfidenz"
                    current={drift.current.inference.confidence_avg}
                    baseline={drift.baseline.inference.confidence_avg}
                    delta={drift.delta.inference.confidence_avg}
                  />
                  <MetricRow
                    label="Median Konfidenz"
                    current={drift.current.inference.confidence_median}
                    baseline={drift.baseline.inference.confidence_median}
                    delta={drift.delta.inference.confidence_median}
                  />
                  <MetricRow
                    label="Fehlerrate"
                    current={drift.current.inference.failure_rate}
                    baseline={drift.baseline.inference.failure_rate}
                    delta={drift.delta.inference.failure_rate}
                    format={fmtPct}
                  />
                  <MetricRow
                    label="Ø Latenz (ms)"
                    current={drift.current.inference.latency_avg_ms}
                    baseline={drift.baseline.inference.latency_avg_ms}
                    delta={null}
                    format={(v) => v == null ? '—' : `${Math.round(v as number)} ms`}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* QA-Metriken */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">QA-Metriken</CardTitle>
              <p className="text-xs text-muted-foreground">
                Zeitfenster vs. Baseline
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : error ? (
                <p className="text-sm text-destructive">Fehler beim Laden.</p>
              ) : drift ? (
                <div>
                  <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                    <span />
                    <div className="flex gap-4">
                      <span className="w-20 text-right">Baseline</span>
                      <span className="w-20 text-right">Aktuell</span>
                      <span className="w-24 text-right">Delta</span>
                    </div>
                  </div>
                  <MetricRow
                    label="Anzahl Checks"
                    current={drift.current.qa.count}
                    baseline={drift.baseline.qa.count}
                    delta={null}
                    format={(v) => v == null ? '—' : String(v)}
                  />
                  <MetricRow
                    label="Pass-Rate"
                    current={drift.current.qa.pass_rate}
                    baseline={drift.baseline.qa.pass_rate}
                    delta={drift.delta.qa.pass_rate}
                    format={fmtPct}
                  />
                  <MetricRow
                    label="Ø Quality-Score"
                    current={drift.current.qa.quality_score_avg}
                    baseline={drift.baseline.qa.quality_score_avg}
                    delta={drift.delta.qa.quality_score_avg}
                  />
                  <MetricRow
                    label="Warnungen"
                    current={drift.current.qa.warn_count}
                    baseline={drift.baseline.qa.warn_count}
                    delta={null}
                    format={(v) => v == null ? '—' : String(v)}
                  />
                  <MetricRow
                    label="Fehler"
                    current={drift.current.qa.fail_count}
                    baseline={drift.baseline.qa.fail_count}
                    delta={null}
                    format={(v) => v == null ? '—' : String(v)}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Verlaufs-Charts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Historischer Verlauf</CardTitle>
            <p className="text-xs text-muted-foreground">
              Basierend auf {snapshots.length} gespeicherten Snapshots
            </p>
          </CardHeader>
          <CardContent>
            <SnapshotChart snapshots={snapshots} />
          </CardContent>
        </Card>

        {/* Snapshot-Tabelle */}
        {snapshots.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Snapshot-Verlauf</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 pr-4">Datum</th>
                      <th className="text-right py-2 px-4">Fenster</th>
                      <th className="text-right py-2 px-4">Ø Konfidenz</th>
                      <th className="text-right py-2 px-4">Pass-Rate</th>
                      <th className="text-right py-2 pl-4">Warnungen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s) => (
                      <tr key={s.id} className={cn(
                        "border-b border-border/40 hover:bg-accent/30 transition-colors",
                        s.payload.alerts.length > 0 && "text-yellow-400"
                      )}>
                        <td className="py-2 pr-4 font-mono">
                          {new Date(s.created_at).toLocaleString('de-DE')}
                        </td>
                        <td className="text-right py-2 px-4">{s.window_days}d</td>
                        <td className="text-right py-2 px-4 font-mono">
                          {fmt(s.payload.current.inference.confidence_avg)}
                        </td>
                        <td className="text-right py-2 px-4 font-mono">
                          {fmtPct(s.payload.current.qa.pass_rate)}
                        </td>
                        <td className="text-right py-2 pl-4">
                          {s.payload.alerts.length > 0 ? (
                            <Badge variant="outline" className="text-yellow-400 border-yellow-500/50 text-[10px]">
                              {s.payload.alerts.length}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

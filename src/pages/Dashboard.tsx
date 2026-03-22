import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Activity,
  Database,
  Server,
  Cpu,
  Mic,
  HardDrive,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/services/apiClient';

interface ServiceStatus {
  status: 'ok' | 'degraded' | 'error' | 'disabled';
  detail?: string;
}

interface HealthResponse {
  status: string;
  services: Record<string, ServiceStatus>;
}

interface Metrics {
  timestamp: string;
  reports_total: number;
  reports_by_status: Record<string, number>;
  qa_status_counts: Record<string, number>;
  inference_job_status_counts: Record<string, number>;
  audit_events_total: number;
}

const serviceIcons: Record<string, typeof Database> = {
  database: Database,
  redis: Server,
  vllm: Cpu,
  medasr: Mic,
  orthanc: HardDrive,
};

const statusStyles: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  ok: { color: 'text-green-400', icon: CheckCircle, label: 'Online' },
  degraded: { color: 'text-yellow-400', icon: AlertTriangle, label: 'Degraded' },
  error: { color: 'text-red-400', icon: XCircle, label: 'Error' },
  disabled: { color: 'text-muted-foreground', icon: AlertTriangle, label: 'Disabled' },
};

export default function Dashboard() {
  const { t } = useTranslation('common');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [h, m] = await Promise.all([
        apiClient.get<HealthResponse>('/api/v1/health'),
        apiClient.get<Metrics>('/api/v1/metrics'),
      ]);
      setHealth(h);
      setMetrics(m);
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t('actions.back')}
              </Button>
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6" />
              System Dashboard
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {t('actions.reload')}
          </Button>
        </div>

        {/* Service Health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            {health ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(health.services).map(([name, svc]) => {
                  const Icon = serviceIcons[name] || Server;
                  const style = statusStyles[svc.status] || statusStyles.error;
                  const StatusIcon = style.icon;
                  return (
                    <div key={name} className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border/50">
                      <Icon className={`h-8 w-8 ${style.color}`} />
                      <span className="text-sm font-medium capitalize">{name}</span>
                      <div className="flex items-center gap-1">
                        <StatusIcon className={`h-3 w-3 ${style.color}`} />
                        <span className={`text-xs ${style.color}`}>{style.label}</span>
                      </div>
                      {svc.detail && (
                        <span className="text-xs text-muted-foreground truncate max-w-full" title={svc.detail}>
                          {svc.detail}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t('status.loading')}</p>
            )}
          </CardContent>
        </Card>

        {/* Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{metrics.reports_total}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(metrics.reports_by_status).map(([status, count]) => (
                    <Badge key={status} variant="secondary" className="text-xs">
                      {status}: {count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">QA Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {Object.entries(metrics.qa_status_counts).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-sm">
                      <span className="capitalize">{status}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Inference Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {Object.entries(metrics.inference_job_status_counts).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-sm">
                      <span className="capitalize">{status}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-border/50">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Audit Events</span>
                    <span>{metrics.audit_events_total}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

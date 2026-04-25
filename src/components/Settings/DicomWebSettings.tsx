import { useState, useCallback } from 'react';
import { Globe, CheckCircle, XCircle, Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface DicomWebConfig {
  url: string;
  username: string;
  password: string;
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

interface ConnectionResult {
  status: ConnectionStatus;
  message: string;
  details?: string;
  latencyMs?: number;
}

const STORAGE_KEY = 'radiolyze.dicomweb.config';

const loadConfig = (): DicomWebConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore
  }
  return {
    url: import.meta.env.VITE_DICOM_WEB_URL ?? 'http://localhost:8042/dicom-web',
    username: import.meta.env.VITE_DICOM_WEB_USERNAME ?? '',
    password: import.meta.env.VITE_DICOM_WEB_PASSWORD ?? '',
  };
};

const saveConfig = (config: DicomWebConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore
  }
};

export function DicomWebSettings() {
  const [config, setConfig] = useState<DicomWebConfig>(loadConfig);
  const [showPassword, setShowPassword] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ConnectionResult>({
    status: 'idle',
    message: '',
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const updateConfig = useCallback((key: keyof DicomWebConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
    setConnectionResult({ status: 'idle', message: '' });
  }, []);

  const handleSave = useCallback(() => {
    saveConfig(config);
    setHasUnsavedChanges(false);
  }, [config]);

  const testConnection = useCallback(async () => {
    setConnectionResult({ status: 'testing', message: 'Verbindung wird getestet...' });

    const startTime = performance.now();
    const baseUrl = config.url.startsWith('/')
      ? `${window.location.origin}${config.url}`
      : config.url;
    const testUrl = baseUrl.endsWith('/')
      ? `${baseUrl}studies?limit=1`
      : `${baseUrl}/studies?limit=1`;

    try {
      const headers: HeadersInit = {
        Accept: 'application/dicom+json, application/json',
      };
      if (config.username && config.password) {
        const token = btoa(`${config.username}:${config.password}`);
        headers['Authorization'] = `Basic ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(testUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      if (response.ok) {
        // Check if response is JSON (DICOMweb) or HTML (wrong endpoint)
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json') || contentType.includes('application/dicom+json')) {
          setConnectionResult({
            status: 'success',
            message: 'Verbindung erfolgreich!',
            details: `Server antwortet in ${latencyMs}ms`,
            latencyMs,
          });
        } else {
          const isHtmlResponse = contentType.includes('text/html');
          setConnectionResult({
            status: 'error',
            message: 'Ungültige Antwort',
            details: isHtmlResponse
              ? `Der Server liefert HTML statt DICOMweb (${contentType}). Möglicherweise ist dies die Orthanc-UI oder eine Login-Seite. Prüfen Sie, dass die URL auf den DICOMweb-Endpunkt zeigt (z.B. http://<host>:8042/dicom-web).`
              : `Der Server antwortet, aber nicht im DICOMweb-Format (${contentType}). Überprüfen Sie die URL.`,
          });
        }
      } else if (response.status === 401 || response.status === 403) {
        setConnectionResult({
          status: 'error',
          message: 'Authentifizierung fehlgeschlagen',
          details: 'Benutzername oder Passwort ist ungültig.',
        });
      } else if (response.status === 404) {
        setConnectionResult({
          status: 'error',
          message: 'Endpunkt nicht gefunden',
          details: `HTTP 404: Der DICOMweb-Endpunkt wurde nicht gefunden. Überprüfen Sie die URL.`,
        });
      } else {
        setConnectionResult({
          status: 'error',
          message: `HTTP ${response.status}`,
          details: `Der Server hat mit Status ${response.status} geantwortet.`,
        });
      }
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        setConnectionResult({
          status: 'error',
          message: 'Zeitüberschreitung',
          details: 'Der Server hat nicht innerhalb von 10 Sekunden geantwortet.',
        });
      } else if (error instanceof TypeError && (error.message.includes('NetworkError') || error.message.includes('fetch'))) {
        setConnectionResult({
          status: 'error',
          message: 'Netzwerkfehler',
          details: `Verbindung zum Server nicht möglich. Mögliche Ursachen:\n• Server nicht erreichbar\n• CORS-Konfiguration fehlt\n• Falsche URL\n\nVersuchen Sie, die URL im Browser zu öffnen: ${baseUrl}`,
        });
      } else {
        setConnectionResult({
          status: 'error',
          message: 'Verbindungsfehler',
          details: error instanceof Error ? error.message : 'Unbekannter Fehler',
        });
      }
    }
  }, [config]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          DICOMweb Server
        </CardTitle>
        <CardDescription>
          Verbindung zum PACS/DICOMweb-Server konfigurieren
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL Field */}
        <div className="space-y-2">
          <Label htmlFor="dicom-url">Server-URL</Label>
          <Input
            id="dicom-url"
            type="text"
            placeholder="/dicom-web"
            value={config.url}
            onChange={(e) => updateConfig('url', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Vollständige URL zum DICOMweb-Endpunkt (WADO-RS/STOW-RS/QIDO-RS).
            Im Docker/SSH-Setup funktioniert meist <span className="font-mono">/dicom-web</span> über den Frontend-Proxy.
          </p>
        </div>

        <Separator />

        {/* Credentials */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dicom-username">Benutzername</Label>
            <Input
              id="dicom-username"
              type="text"
              placeholder="(optional)"
              value={config.username}
              onChange={(e) => updateConfig('username', e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dicom-password">Passwort</Label>
            <div className="relative">
              <Input
                id="dicom-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="(optional)"
                value={config.password}
                onChange={(e) => updateConfig('password', e.target.value)}
                autoComplete="current-password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          HTTP Basic Authentication (falls erforderlich)
        </p>

        <Separator />

        {/* Connection Test Result */}
        {connectionResult.status !== 'idle' && (
          <Alert
            variant={connectionResult.status === 'error' ? 'destructive' : 'default'}
            className={cn(
              connectionResult.status === 'success' && 'border-success bg-success/10'
            )}
          >
            {connectionResult.status === 'testing' && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {connectionResult.status === 'success' && (
              <CheckCircle className="h-4 w-4 text-success" />
            )}
            {connectionResult.status === 'error' && (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>{connectionResult.message}</AlertTitle>
            {connectionResult.details && (
              <AlertDescription className="mt-2 whitespace-pre-line text-sm">
                {connectionResult.details}
              </AlertDescription>
            )}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={connectionResult.status === 'testing' || !config.url}
            >
              {connectionResult.status === 'testing' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Verbindung testen
            </Button>
            {connectionResult.status === 'success' && connectionResult.latencyMs && (
              <Badge variant="secondary" className="text-xs">
                {connectionResult.latencyMs}ms
              </Badge>
            )}
          </div>
          <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
            Speichern
          </Button>
        </div>

        {hasUnsavedChanges && (
          <p className="text-xs text-warning">
            Ungespeicherte Änderungen. Klicken Sie auf &quot;Speichern&quot;, um die Konfiguration zu übernehmen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

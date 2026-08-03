import { useState, useCallback } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Globe, CheckCircle, XCircle, Loader2, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { DEFAULT_DICOM_WEB_URL } from "@/config/dicomWeb";

interface DicomWebConfig {
  url: string;
  username: string;
  password: string;
}

type ConnectionStatus = "idle" | "testing" | "success" | "error";

/**
 * The outcome carries translation keys rather than resolved strings: the alert
 * stays on screen across a language switch, so resolving at render time is what
 * keeps it in the active language.
 */
interface ConnectionResult {
  status: ConnectionStatus;
  /** Key under `settings:dicomweb.result`. */
  messageKey?: string;
  /** Key under `settings:dicomweb.result`. */
  detailsKey?: string;
  /** Verbatim detail text for the one case that has no key: a server-supplied message. */
  details?: string;
  values?: Record<string, string | number>;
  latencyMs?: number;
}

const STORAGE_KEY = "radiolyze.dicomweb.config";

const TEST_TIMEOUT_MS = 10000;

const loadConfig = (): DicomWebConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    // Corrupt JSON; fall through to env-based defaults.
    logger.debug("Failed to load stored DICOMweb config", err);
  }
  return {
    url: import.meta.env.VITE_DICOM_WEB_URL ?? DEFAULT_DICOM_WEB_URL,
    username: import.meta.env.VITE_DICOM_WEB_USERNAME ?? "",
    password: import.meta.env.VITE_DICOM_WEB_PASSWORD ?? "",
  };
};

const saveConfig = (config: DicomWebConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    // Storage full or unavailable; setting persists for the session only.
    logger.debug("Failed to persist DICOMweb config", err);
  }
};

export function DicomWebSettings() {
  const { t } = useTranslation("settings");
  const [config, setConfig] = useState<DicomWebConfig>(loadConfig);
  const [showPassword, setShowPassword] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ConnectionResult>({
    status: "idle",
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const updateConfig = useCallback((key: keyof DicomWebConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
    setConnectionResult({ status: "idle" });
  }, []);

  const handleSave = useCallback(() => {
    saveConfig(config);
    setHasUnsavedChanges(false);
  }, [config]);

  const testConnection = useCallback(async () => {
    setConnectionResult({ status: "testing", messageKey: "testing" });

    const startTime = performance.now();
    const baseUrl = config.url.startsWith("/")
      ? `${window.location.origin}${config.url}`
      : config.url;
    const testUrl = baseUrl.endsWith("/")
      ? `${baseUrl}studies?limit=1`
      : `${baseUrl}/studies?limit=1`;

    try {
      const headers: HeadersInit = {
        Accept: "application/dicom+json, application/json",
      };
      if (config.username && config.password) {
        const token = btoa(`${config.username}:${config.password}`);
        headers["Authorization"] = `Basic ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

      const response = await fetch(testUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      if (response.ok) {
        // Check if response is JSON (DICOMweb) or HTML (wrong endpoint)
        const contentType = response.headers.get("content-type") || "";
        if (
          contentType.includes("application/json") ||
          contentType.includes("application/dicom+json")
        ) {
          setConnectionResult({
            status: "success",
            messageKey: "success",
            detailsKey: "successDetails",
            values: { latencyMs },
            latencyMs,
          });
        } else {
          const isHtmlResponse = contentType.includes("text/html");
          setConnectionResult({
            status: "error",
            messageKey: "invalidResponse",
            detailsKey: isHtmlResponse ? "invalidResponseHtml" : "invalidResponseFormat",
            values: { contentType },
          });
        }
      } else if (response.status === 401 || response.status === 403) {
        setConnectionResult({
          status: "error",
          messageKey: "authFailed",
          detailsKey: "authFailedDetails",
        });
      } else if (response.status === 404) {
        setConnectionResult({
          status: "error",
          messageKey: "notFound",
          detailsKey: "notFoundDetails",
        });
      } else {
        setConnectionResult({
          status: "error",
          messageKey: "httpError",
          detailsKey: "httpErrorDetails",
          values: { status: response.status },
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setConnectionResult({
          status: "error",
          messageKey: "timeout",
          detailsKey: "timeoutDetails",
          values: { seconds: TEST_TIMEOUT_MS / 1000 },
        });
      } else if (
        error instanceof TypeError &&
        (error.message.includes("NetworkError") || error.message.includes("fetch"))
      ) {
        setConnectionResult({
          status: "error",
          messageKey: "networkError",
          detailsKey: "networkErrorDetails",
          values: { url: baseUrl },
        });
      } else {
        setConnectionResult({
          status: "error",
          messageKey: "connectionError",
          // The server's own message when there is one; it is not ours to translate.
          detailsKey: error instanceof Error ? undefined : "unknownError",
          details: error instanceof Error ? error.message : undefined,
        });
      }
    }
  }, [config]);

  const details =
    connectionResult.details ??
    (connectionResult.detailsKey
      ? t(`dicomweb.result.${connectionResult.detailsKey}`, connectionResult.values)
      : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t("dicomweb.title")}
        </CardTitle>
        <CardDescription>{t("dicomweb.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL Field */}
        <div className="space-y-2">
          <Label htmlFor="dicom-url">{t("dicomweb.url")}</Label>
          <Input
            id="dicom-url"
            type="text"
            placeholder={t("dicomweb.urlPlaceholder")}
            value={config.url}
            onChange={(e) => updateConfig("url", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            <Trans
              t={t}
              i18nKey="dicomweb.urlHint"
              components={{ path: <span className="font-mono" /> }}
            />
          </p>
        </div>

        <Separator />

        {/* Credentials */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dicom-username">{t("dicomweb.username")}</Label>
            <Input
              id="dicom-username"
              type="text"
              placeholder={t("dicomweb.usernamePlaceholder")}
              value={config.username}
              onChange={(e) => updateConfig("username", e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dicom-password">{t("dicomweb.password")}</Label>
            <div className="relative">
              <Input
                id="dicom-password"
                type={showPassword ? "text" : "password"}
                placeholder={t("dicomweb.passwordPlaceholder")}
                value={config.password}
                onChange={(e) => updateConfig("password", e.target.value)}
                autoComplete="current-password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                aria-label={t(showPassword ? "dicomweb.hidePassword" : "dicomweb.showPassword")}
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
        <p className="text-xs text-muted-foreground">{t("dicomweb.credentialsHint")}</p>

        <Separator />

        {/* Connection Test Result */}
        {connectionResult.status !== "idle" && (
          <Alert
            variant={connectionResult.status === "error" ? "destructive" : "default"}
            className={cn(connectionResult.status === "success" && "border-success bg-success/10")}
          >
            {connectionResult.status === "testing" && <Loader2 className="h-4 w-4 animate-spin" />}
            {connectionResult.status === "success" && (
              <CheckCircle className="h-4 w-4 text-success" />
            )}
            {connectionResult.status === "error" && <XCircle className="h-4 w-4" />}
            <AlertTitle>
              {connectionResult.messageKey &&
                t(`dicomweb.result.${connectionResult.messageKey}`, connectionResult.values)}
            </AlertTitle>
            {details && (
              <AlertDescription className="mt-2 whitespace-pre-line text-sm">
                {details}
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
              disabled={connectionResult.status === "testing" || !config.url}
            >
              {connectionResult.status === "testing" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t("dicomweb.testConnection")}
            </Button>
            {connectionResult.status === "success" && connectionResult.latencyMs && (
              <Badge variant="secondary" className="text-xs">
                {connectionResult.latencyMs}ms
              </Badge>
            )}
          </div>
          <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
            {t("dicomweb.save")}
          </Button>
        </div>

        {hasUnsavedChanges && (
          <p className="text-xs text-warning">{t("dicomweb.unsavedChanges")}</p>
        )}
      </CardContent>
    </Card>
  );
}

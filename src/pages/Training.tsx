import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  FileJson,
  Database,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BarChart3,
  Tag,
  Layers,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  getTrainingStats,
  getAnnotationCategories,
  exportAndDownload,
  getTrainingManifest,
  downloadBlob,
  type ExportFormat,
  type ExportRequest,
  type ManifestResponse,
} from "@/services/trainingClient";
import { toast } from "sonner";

// Product names stay as they are; only the descriptions are translated.
const FORMAT_INFO: Record<ExportFormat, { name: string; icon: typeof FileJson }> = {
  coco: { name: "COCO", icon: FileJson },
  huggingface: { name: "HuggingFace", icon: Database },
  radiolyze: { name: "Radiolyze", icon: Sparkles },
};

// Slider bounds, shared with the labels underneath it. Keeping the percentages
// out of the resources means a bound can only be changed in one place.
const SPLIT_MIN = 0.5;
const SPLIT_MAX = 0.95;

export default function Training() {
  const { t } = useTranslation("training");
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("radiolyze");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [splitRatio, setSplitRatio] = useState([0.8]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [includeImages, setIncludeImages] = useState(false);
  const [manifest, setManifest] = useState<ManifestResponse | null>(null);
  const [isDownloadingManifest, setIsDownloadingManifest] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["training-stats", verifiedOnly],
    queryFn: () => getTrainingStats({ verifiedOnly }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["annotation-categories"],
    queryFn: getAnnotationCategories,
  });

  // Defensive: ensure categories is always an array
  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  const exportMutation = useMutation({
    mutationFn: exportAndDownload,
    onSuccess: () => {
      toast.success(t("toast.exportSuccess"), {
        description: t("toast.exportSuccessDescription"),
      });
    },
    onError: (error: Error) => {
      toast.error(t("toast.exportError"), {
        description: error.message,
      });
    },
  });

  const manifestMutation = useMutation({
    mutationFn: getTrainingManifest,
    onSuccess: (data) => {
      setManifest(data);
      toast.success(t("toast.manifestReady"), {
        description: t("toast.manifestReadyDescription", { count: data.total }),
      });
    },
    onError: (error: Error) => {
      toast.error(t("toast.manifestError"), {
        description: error.message,
      });
    },
  });

  const handleExport = () => {
    const request: ExportRequest = {
      format: selectedFormat,
      verifiedOnly,
      splitRatio: splitRatio[0],
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      includeImages,
    };
    exportMutation.mutate(request);
  };

  const buildManifestRequest = (limit?: number, checkImages?: boolean) => ({
    verifiedOnly,
    splitRatio: splitRatio[0],
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    limit,
    checkImages,
  });

  const handleManifestPreview = () => {
    manifestMutation.mutate(buildManifestRequest(50));
  };

  const handleManifestCheck = () => {
    manifestMutation.mutate(buildManifestRequest(50, true));
  };

  const handleManifestDownload = async () => {
    setIsDownloadingManifest(true);
    try {
      const data = await getTrainingManifest(buildManifestRequest(undefined, true));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `radiolyze-manifest-${timestamp}.json`);
      toast.success(t("toast.manifestDownloaded"));
    } catch (error) {
      toast.error(t("toast.manifestDownloadError"), {
        description: error instanceof Error ? error.message : t("toast.unknownError"),
      });
    } finally {
      setIsDownloadingManifest(false);
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  useEffect(() => {
    if (!includeImages) {
      setManifest(null);
    }
  }, [includeImages]);

  useEffect(() => {
    setManifest(null);
  }, [selectedCategories, verifiedOnly, splitRatio]);

  const verifiedPercentage = stats
    ? Math.round((stats.verifiedAnnotations / stats.totalAnnotations) * 100) || 0
    : 0;

  const trainCount = stats ? Math.round(stats.totalAnnotations * splitRatio[0]) : 0;
  const valCount = stats ? stats.totalAnnotations - trainCount : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{t("header.title")}</h1>
        <Badge variant="outline" className="ml-2">
          {t("header.badge")}
        </Badge>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="mb-4">
          <p className="text-muted-foreground">{t("header.subtitle")}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {/* Stats Cards */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                {t("stats.annotations")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{stats?.totalAnnotations || 0}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Progress value={verifiedPercentage} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {t("stats.verifiedPercentage", { percent: verifiedPercentage })}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4" />
                {t("stats.studiesAndSeries")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="flex gap-4">
                  <div>
                    <div className="text-3xl font-bold">{stats?.studies || 0}</div>
                    <div className="text-xs text-muted-foreground">{t("stats.studies")}</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{stats?.series || 0}</div>
                    <div className="text-xs text-muted-foreground">{t("stats.series")}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t("stats.split")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div>
                  <div className="text-3xl font-bold text-primary">{trainCount}</div>
                  <div className="text-xs text-muted-foreground">{t("stats.training")}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-muted-foreground">{valCount}</div>
                  <div className="text-xs text-muted-foreground">{t("stats.validation")}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Export Format Selection */}
          <Card>
            <CardHeader>
              <CardTitle>{t("formats.title")}</CardTitle>
              <CardDescription>{t("formats.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(Object.entries(FORMAT_INFO) as [ExportFormat, (typeof FORMAT_INFO)["coco"]][]).map(
                ([format, info]) => (
                  // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- pre-existing click-only selection pattern, keyboard support tracked separately
                  <div
                    key={format}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors",
                      selectedFormat === format
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    )}
                    onClick={() => setSelectedFormat(format)}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        selectedFormat === format
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      <info.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {info.name}
                        {selectedFormat === format && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{t(`formats.${format}`)}</div>
                    </div>
                  </div>
                ),
              )}
            </CardContent>
          </Card>

          {/* Export Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                {t("settings.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Verified Only Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="verified-only">{t("settings.verifiedOnly")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.verifiedOnlyHint")}</p>
                </div>
                <Switch
                  id="verified-only"
                  checked={verifiedOnly}
                  onCheckedChange={setVerifiedOnly}
                />
              </div>

              {/* Split Ratio Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t("stats.split")}</Label>
                  <span className="text-sm font-medium">
                    {Math.round(splitRatio[0] * 100)}% / {Math.round((1 - splitRatio[0]) * 100)}%
                  </span>
                </div>
                <Slider
                  value={splitRatio}
                  onValueChange={setSplitRatio}
                  min={SPLIT_MIN}
                  max={SPLIT_MAX}
                  step={0.05}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("settings.splitBound", { percent: Math.round(SPLIT_MIN * 100) })}</span>
                  <span>{t("settings.splitBound", { percent: Math.round(SPLIT_MAX * 100) })}</span>
                </div>
              </div>

              {/* Category Filter */}
              <div className="space-y-3">
                <Label>{t("settings.categories")}</Label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(({ category, count }) => (
                    <Badge
                      key={category}
                      variant={selectedCategories.includes(category) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleCategory(category)}
                    >
                      {category} ({count})
                    </Badge>
                  ))}
                </div>
                {selectedCategories.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCategories([])}>
                    {t("settings.resetFilter")}
                  </Button>
                )}
              </div>

              {/* Data Capture */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="include-images">{t("dataCapture.includeImages")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("dataCapture.includeImagesHint")}
                    </p>
                  </div>
                  <Switch
                    id="include-images"
                    checked={includeImages}
                    onCheckedChange={setIncludeImages}
                  />
                </div>

                {includeImages && (
                  <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManifestPreview}
                        disabled={manifestMutation.isPending || !stats?.totalAnnotations}
                      >
                        {manifestMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {t("dataCapture.generatingManifest")}
                          </>
                        ) : (
                          t("dataCapture.generateManifest")
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManifestCheck}
                        disabled={manifestMutation.isPending || !stats?.totalAnnotations}
                      >
                        {t("dataCapture.checkImages")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleManifestDownload}
                        disabled={isDownloadingManifest || !stats?.totalAnnotations}
                      >
                        {isDownloadingManifest
                          ? t("dataCapture.downloadingManifest")
                          : t("dataCapture.downloadManifest")}
                      </Button>
                    </div>

                    {manifest && (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          {t("dataCapture.catalogCount", { count: manifest.total })}
                          {manifest.images.length !== manifest.total && (
                            <span className="text-muted-foreground">
                              {t("dataCapture.previewCount", { count: manifest.images.length })}
                            </span>
                          )}
                        </div>
                        {manifest.status && (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{t("dataCapture.statusOk", { count: manifest.status.ok })}</span>
                            <span>
                              {t("dataCapture.statusError", { count: manifest.status.error })}
                            </span>
                          </div>
                        )}
                        <div className="space-y-1">
                          {manifest.images.slice(0, 3).map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between rounded bg-background px-2 py-1 text-xs"
                            >
                              <span className="font-mono">{entry.id}</span>
                              <span className="text-muted-foreground">
                                {entry.splits.join(", ")}
                                {entry.status === "error" && ` · ${t("dataCapture.entryError")}`}
                              </span>
                            </div>
                          ))}
                          {manifest.images.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              {t("dataCapture.moreEntries", { count: manifest.images.length - 3 })}
                            </div>
                          )}
                        </div>
                        {manifest.status?.error ? (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              {t("dataCapture.errorListTitle")}
                            </div>
                            {manifest.images
                              .filter((entry) => entry.status === "error")
                              .slice(0, 3)
                              .map((entry) => (
                                <div
                                  key={`${entry.id}-error`}
                                  className="rounded border border-warning/30 bg-warning/5 px-2 py-1 text-xs"
                                >
                                  <div className="font-mono">{entry.id}</div>
                                  <div className="text-muted-foreground">
                                    {entry.error || t("dataCapture.fetchFailed")}
                                  </div>
                                </div>
                              ))}
                            {manifest.status.error > 3 && (
                              <div className="text-xs text-muted-foreground">
                                {t("dataCapture.moreErrors", { count: manifest.status.error - 3 })}
                              </div>
                            )}
                          </div>
                        ) : null}
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <AlertCircle className="h-4 w-4 mt-0.5" />
                          {t("dataCapture.manifestHint")}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export Action */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{t("export.readyTitle")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("export.readySummary", {
                    count: stats?.totalAnnotations || 0,
                    format: FORMAT_INFO[selectedFormat].name,
                  })}
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleExport}
                disabled={exportMutation.isPending || !stats?.totalAnnotations}
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("export.inProgress")}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    {t("export.action")}
                  </>
                )}
              </Button>
            </div>
            {includeImages && (
              <div className="mt-3 text-xs text-muted-foreground">
                <Trans t={t} i18nKey="export.zipHint" components={{ code: <code /> }} />
              </div>
            )}

            {!stats?.totalAnnotations && !statsLoading && (
              <div className="mt-4 p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning">{t("empty.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

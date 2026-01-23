import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  getTrainingStats,
  getAnnotationCategories,
  exportAndDownload,
  type ExportFormat,
  type ExportRequest,
} from '@/services/trainingClient';
import { toast } from 'sonner';

const FORMAT_INFO: Record<ExportFormat, { name: string; description: string; icon: typeof FileJson }> = {
  coco: {
    name: 'COCO',
    description: 'Standard Object Detection Format. Kompatibel mit detectron2, MMDetection, YOLO.',
    icon: FileJson,
  },
  huggingface: {
    name: 'HuggingFace',
    description: 'JSONL Dataset Format für 🤗 Transformers und datasets Library.',
    icon: Database,
  },
  medgemma: {
    name: 'MedGemma',
    description: 'Optimiertes Format für MedGemma 1.5 Multimodal Fine-Tuning mit LoRA.',
    icon: Sparkles,
  },
};

export default function Training() {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('medgemma');
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [splitRatio, setSplitRatio] = useState([0.8]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['training-stats', verifiedOnly],
    queryFn: () => getTrainingStats({ verifiedOnly }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['annotation-categories'],
    queryFn: getAnnotationCategories,
  });

  const exportMutation = useMutation({
    mutationFn: exportAndDownload,
    onSuccess: () => {
      toast.success('Export erfolgreich', {
        description: 'Das Training-Dataset wurde heruntergeladen.',
      });
    },
    onError: (error: Error) => {
      toast.error('Export fehlgeschlagen', {
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
    };
    exportMutation.mutate(request);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

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
        <h1 className="text-lg font-semibold">Training Data Export</h1>
        <Badge variant="outline" className="ml-2">
          MedGemma Fine-Tuning
        </Badge>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="mb-4">
          <p className="text-muted-foreground">
            Exportieren Sie Ihre Annotations für MedGemma 1.5 Fine-Tuning
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {/* Stats Cards */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Annotations
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
                      {verifiedPercentage}% verifiziert
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
                Studien & Serien
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="flex gap-4">
                  <div>
                    <div className="text-3xl font-bold">{stats?.studies || 0}</div>
                    <div className="text-xs text-muted-foreground">Studien</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{stats?.series || 0}</div>
                    <div className="text-xs text-muted-foreground">Serien</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Train/Val Split
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div>
                  <div className="text-3xl font-bold text-primary">{trainCount}</div>
                  <div className="text-xs text-muted-foreground">Training</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-muted-foreground">{valCount}</div>
                  <div className="text-xs text-muted-foreground">Validation</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Export Format Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Export Format</CardTitle>
              <CardDescription>
                Wählen Sie das passende Format für Ihr Fine-Tuning Framework
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(Object.entries(FORMAT_INFO) as [ExportFormat, typeof FORMAT_INFO['coco']][]).map(
                ([format, info]) => (
                  <div
                    key={format}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors',
                      selectedFormat === format
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => setSelectedFormat(format)}
                  >
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        selectedFormat === format ? 'bg-primary text-primary-foreground' : 'bg-muted'
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
                      <div className="text-sm text-muted-foreground">{info.description}</div>
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Export Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Export Einstellungen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Verified Only Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="verified-only">Nur verifizierte Annotations</Label>
                  <p className="text-sm text-muted-foreground">
                    Empfohlen für höhere Datenqualität
                  </p>
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
                  <Label>Train/Val Split</Label>
                  <span className="text-sm font-medium">
                    {Math.round(splitRatio[0] * 100)}% / {Math.round((1 - splitRatio[0]) * 100)}%
                  </span>
                </div>
                <Slider
                  value={splitRatio}
                  onValueChange={setSplitRatio}
                  min={0.5}
                  max={0.95}
                  step={0.05}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50% Train</span>
                  <span>95% Train</span>
                </div>
              </div>

              {/* Category Filter */}
              <div className="space-y-3">
                <Label>Kategorien filtern (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(({ category, count }) => (
                    <Badge
                      key={category}
                      variant={selectedCategories.includes(category) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleCategory(category)}
                    >
                      {category} ({count})
                    </Badge>
                  ))}
                </div>
                {selectedCategories.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCategories([])}
                  >
                    Filter zurücksetzen
                  </Button>
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
                <h3 className="font-semibold">Bereit zum Export</h3>
                <p className="text-sm text-muted-foreground">
                  {stats?.totalAnnotations || 0} Annotations in {FORMAT_INFO[selectedFormat].name}{' '}
                  Format
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
                    Exportiere...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Dataset exportieren
                  </>
                )}
              </Button>
            </div>

            {!stats?.totalAnnotations && !statsLoading && (
              <div className="mt-4 p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning">Keine Annotations vorhanden</p>
                  <p className="text-sm text-muted-foreground">
                    Verwenden Sie die Annotation-Tools im Viewer, um Trainings-Daten zu erstellen.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

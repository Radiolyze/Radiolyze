import { ArrowLeft, User, Monitor, Mic, Image, FileText, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { DicomWebSettings } from '@/components/Settings/DicomWebSettings';
import { toast } from 'sonner';

export default function Settings() {
  const { preferences, setPreference, resetPreferences } = useUserPreferences();

  const handleReset = () => {
    resetPreferences();
    toast.success('Einstellungen zurückgesetzt');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Einstellungen</h1>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profil
            </CardTitle>
            <CardDescription>
              Persönliche Informationen und Signatur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" defaultValue="Dr. Radiologe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" defaultValue="radiologe@klinik.de" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signature">Digitale Signatur</Label>
              <Input id="signature" placeholder="Dr. med. Max Mustermann" />
              <p className="text-xs text-muted-foreground">
                Wird bei Report-Freigabe verwendet
              </p>
            </div>
          </CardContent>
        </Card>

        {/* DICOMweb Server Configuration */}
        <DicomWebSettings />

        {/* Display Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Darstellung
            </CardTitle>
            <CardDescription>
              Theme, Schriftgröße und Layout-Optionen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Theme</Label>
                <p className="text-xs text-muted-foreground">
                  Farbschema der Anwendung
                </p>
              </div>
              <Select
                value={preferences.theme}
                onValueChange={(v) => setPreference('theme', v as 'dark' | 'light' | 'system')}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dunkel</SelectItem>
                  <SelectItem value="light">Hell</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Schriftgröße</Label>
                <p className="text-xs text-muted-foreground">
                  Textgröße in der Anwendung
                </p>
              </div>
              <Select
                value={preferences.fontSize}
                onValueChange={(v) => setPreference('fontSize', v as 'small' | 'medium' | 'large')}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Klein</SelectItem>
                  <SelectItem value="medium">Normal</SelectItem>
                  <SelectItem value="large">Groß</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Kompakter Modus</Label>
                <p className="text-xs text-muted-foreground">
                  Reduzierte Abstände für mehr Inhalt
                </p>
              </div>
              <Switch
                checked={preferences.compactMode}
                onCheckedChange={(v) => setPreference('compactMode', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Audio / ASR Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Audio & Spracherkennung
            </CardTitle>
            <CardDescription>
              Mikrofon und ASR-Einstellungen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Mikrofon aktiviert</Label>
                <p className="text-xs text-muted-foreground">
                  Diktierfunktion einschalten
                </p>
              </div>
              <Switch
                checked={preferences.microphoneEnabled}
                onCheckedChange={(v) => setPreference('microphoneEnabled', v)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>ASR-Sprache</Label>
                <p className="text-xs text-muted-foreground">
                  Sprache für Spracherkennung
                </p>
              </div>
              <Select
                value={preferences.asrLanguage}
                onValueChange={(v) => setPreference('asrLanguage', v as 'de-DE' | 'en-US')}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de-DE">Deutsch</SelectItem>
                  <SelectItem value="en-US">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Transkription</Label>
                <p className="text-xs text-muted-foreground">
                  Text automatisch einfügen nach Diktat
                </p>
              </div>
              <Switch
                checked={preferences.autoTranscribe}
                onCheckedChange={(v) => setPreference('autoTranscribe', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Viewer Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              DICOM Viewer
            </CardTitle>
            <CardDescription>
              Standardwerkzeuge und Anzeigeoptionen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Standard-Werkzeug</Label>
                <p className="text-xs text-muted-foreground">
                  Aktives Tool beim Öffnen einer Serie
                </p>
              </div>
              <Select
                value={preferences.defaultTool}
                onValueChange={(v) => setPreference('defaultTool', v as 'zoom' | 'pan' | 'measure' | 'window')}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="window">Window/Level</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="pan">Pan</SelectItem>
                  <SelectItem value="measure">Messen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Farben invertieren</Label>
                <p className="text-xs text-muted-foreground">
                  Negativdarstellung der Bilder
                </p>
              </div>
              <Switch
                checked={preferences.invertColors}
                onCheckedChange={(v) => setPreference('invertColors', v)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Overlays anzeigen</Label>
                <p className="text-xs text-muted-foreground">
                  Patient/Studien-Info auf Bildern
                </p>
              </div>
              <Switch
                checked={preferences.showOverlays}
                onCheckedChange={(v) => setPreference('showOverlays', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Report Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Befundung
            </CardTitle>
            <CardDescription>
              KI-Assistenz und QA-Einstellungen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Impression</Label>
                <p className="text-xs text-muted-foreground">
                  KI-Beurteilung automatisch generieren
                </p>
              </div>
              <Switch
                checked={preferences.autoGenerateImpression}
                onCheckedChange={(v) => setPreference('autoGenerateImpression', v)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>QA-Warnungen anzeigen</Label>
                <p className="text-xs text-muted-foreground">
                  Hinweise bei fehlenden Angaben
                </p>
              </div>
              <Switch
                checked={preferences.showQAWarnings}
                onCheckedChange={(v) => setPreference('showQAWarnings', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Reset Button */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Alle Einstellungen zurücksetzen
          </Button>
        </div>
      </main>
    </div>
  );
}

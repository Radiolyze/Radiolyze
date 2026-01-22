import { ArrowLeft, User, Monitor, Mic, Image, FileText, RotateCcw, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useUserPreferences, type UILanguage } from '@/hooks/useUserPreferences';
import { DicomWebSettings } from '@/components/Settings/DicomWebSettings';
import { PromptSettings } from '@/components/Settings/PromptSettings';
import { toast } from 'sonner';

export default function Settings() {
  const { t } = useTranslation('settings');
  const { preferences, setPreference, resetPreferences } = useUserPreferences();

  const handleReset = () => {
    resetPreferences();
    toast.success(t('actions.reset'));
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
        <h1 className="text-lg font-semibold">{t('title')}</h1>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('profile.title')}
            </CardTitle>
            <CardDescription>
              {t('subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('profile.name')}</Label>
                <Input id="name" defaultValue="Dr. Radiologe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('profile.email')}</Label>
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

        {/* Prompt Configuration */}
        <PromptSettings />

        {/* Display Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              {t('display.title')}
            </CardTitle>
            <CardDescription>
              {t('display.themeOptions.dark')}, {t('display.themeOptions.light')}, {t('display.language')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Language Selector */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {t('display.language')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  UI-Sprache / UI language
                </p>
              </div>
              <Select
                value={preferences.uiLanguage}
                onValueChange={(v) => setPreference('uiLanguage', v as UILanguage)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">{t('display.languageOptions.de')}</SelectItem>
                  <SelectItem value="en">{t('display.languageOptions.en')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('display.theme')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('display.themeOptions.dark')} / {t('display.themeOptions.light')} / {t('display.themeOptions.system')}
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
                  <SelectItem value="dark">{t('display.themeOptions.dark')}</SelectItem>
                  <SelectItem value="light">{t('display.themeOptions.light')}</SelectItem>
                  <SelectItem value="system">{t('display.themeOptions.system')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('display.fontSize')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('display.fontSizeOptions.small')} / {t('display.fontSizeOptions.medium')} / {t('display.fontSizeOptions.large')}
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
                  <SelectItem value="small">{t('display.fontSizeOptions.small')}</SelectItem>
                  <SelectItem value="medium">{t('display.fontSizeOptions.medium')}</SelectItem>
                  <SelectItem value="large">{t('display.fontSizeOptions.large')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('display.compactMode')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('display.compactModeDescription')}
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
              {t('audio.title')}
            </CardTitle>
            <CardDescription>
              {t('audio.microphoneDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('audio.microphone')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('audio.microphoneDescription')}
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
                <Label>{t('audio.asrLanguage')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('audio.asrLanguageOptions.de-DE')} / {t('audio.asrLanguageOptions.en-US')}
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
                  <SelectItem value="de-DE">{t('audio.asrLanguageOptions.de-DE')}</SelectItem>
                  <SelectItem value="en-US">{t('audio.asrLanguageOptions.en-US')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('audio.autoTranscribe')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('audio.autoTranscribeDescription')}
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
              {t('viewer.title')}
            </CardTitle>
            <CardDescription>
              {t('viewer.defaultTool')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('viewer.defaultTool')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('viewer.toolOptions.window')} / {t('viewer.toolOptions.zoom')} / {t('viewer.toolOptions.pan')}
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
                  <SelectItem value="window">{t('viewer.toolOptions.window')}</SelectItem>
                  <SelectItem value="zoom">{t('viewer.toolOptions.zoom')}</SelectItem>
                  <SelectItem value="pan">{t('viewer.toolOptions.pan')}</SelectItem>
                  <SelectItem value="measure">{t('viewer.toolOptions.measure')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('viewer.invertColors')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('viewer.invertColorsDescription')}
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
                <Label>{t('viewer.showOverlays')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('viewer.showOverlaysDescription')}
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
              {t('report.title')}
            </CardTitle>
            <CardDescription>
              {t('report.autoGenerateImpressionDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('report.autoGenerateImpression')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('report.autoGenerateImpressionDescription')}
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
                <Label>{t('report.showQAWarnings')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('report.showQAWarningsDescription')}
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
            {t('system.resetSettings')}
          </Button>
        </div>
      </main>
    </div>
  );
}

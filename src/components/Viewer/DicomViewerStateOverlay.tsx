import { ViewerEmptyState } from './ViewerEmptyState';

interface DicomViewerStateOverlayProps {
  isLoading: boolean;
  hasStack: boolean;
  error?: string | null;
}

export function DicomViewerStateOverlay({
  isLoading,
  hasStack,
  error,
}: DicomViewerStateOverlayProps) {
  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-viewer/80">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full spinner" />
          <p className="text-muted-foreground">Lade DICOM-Bilder...</p>
        </div>
      </div>
    );
  }

  if (!hasStack || error) {
    return (
      <ViewerEmptyState
        variant="overlay"
        title={error ?? 'Keine DICOM-Bilder geladen'}
        subtitle="Prüfen Sie DICOMweb-Verbindung und Serien-ID."
      />
    );
  }

  return null;
}

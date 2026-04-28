import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Series } from '@/types/radiology';
import type { SegmentationJobResponse } from '@/types/segmentation';

// Radix Slider relies on ResizeObserver; jsdom doesn't provide it.
class StubResizeObserver implements ResizeObserver {
  constructor(_cb: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
}

const mocks = vi.hoisted(() => ({
  setVisibility: vi.fn(),
  setOpacity: vi.fn(),
  setColor: vi.fn(),
  loadVtp: vi.fn(),
  resetCamera: vi.fn(),
  start: vi.fn(async () => undefined),
  fetchMesh: vi.fn(async () => new ArrayBuffer(8)),
  segmentationState: {
    jobId: 'job-1',
    status: undefined as SegmentationJobResponse | undefined,
    isStarting: false,
    error: null as Error | null,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/useMeshScene', () => ({
  useMeshScene: () => ({
    containerRef: { current: null },
    loadVtp: mocks.loadVtp,
    setVisibility: mocks.setVisibility,
    setOpacity: mocks.setOpacity,
    setColor: mocks.setColor,
    resetCamera: mocks.resetCamera,
    isReady: true,
  }),
}));

vi.mock('@/hooks/useSegmentation', () => ({
  useSegmentation: () => ({
    jobId: mocks.segmentationState.jobId,
    status: mocks.segmentationState.status,
    isStarting: mocks.segmentationState.isStarting,
    start: mocks.start,
    reset: vi.fn(),
    error: mocks.segmentationState.error,
  }),
}));

vi.mock('@/services/segmentationClient', () => ({
  segmentationClient: {
    fetchMesh: mocks.fetchMesh,
    createJob: vi.fn(),
    getStatus: vi.fn(),
    meshUrl: vi.fn(),
  },
}));

import { MeshViewer } from '../MeshViewer';

const ctSeries: Series = {
  id: 'series-1',
  studyId: 'study-1',
  seriesNumber: 1,
  seriesDescription: 'CT Thorax',
  modality: 'CT',
  frameCount: 120,
};

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('MeshViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.segmentationState.status = undefined;
  });

  it('shows the disclaimer banner', () => {
    renderWithQuery(<MeshViewer series={ctSeries} studyUid="1.2.3" />);
    expect(screen.getByText('mesh.disclaimer')).toBeInTheDocument();
  });

  it('triggers segmentation start when the user clicks Generate', async () => {
    renderWithQuery(<MeshViewer series={ctSeries} studyUid="1.2.3" />);
    fireEvent.click(screen.getByText('mesh.generate'));
    await waitFor(() => expect(mocks.start).toHaveBeenCalled());
    expect(mocks.start).toHaveBeenCalledWith({
      studyUid: '1.2.3',
      seriesUid: 'series-1',
      preset: 'bone',
    });
  });

  it('renders a label panel and toggles visibility once finished', async () => {
    mocks.segmentationState.status = {
      job_id: 'job-1',
      status: 'finished',
      progress: 1,
      preset: 'bone',
      study_uid: '1.2.3',
      series_uid: 'series-1',
      manifest: {
        job_id: 'job-1',
        preset: 'bone',
        source: { study_uid: '1.2.3', series_uid: 'series-1', modality: 'CT' },
        volume: { spacing: [1, 1, 1], origin: [0, 0, 0], direction: [], shape: [] },
        labels: [
          {
            id: 1,
            name: 'bone',
            color: [0.93, 0.87, 0.74],
            volume_ml: 124.5,
            voxel_count: 12345,
            mask_url: '/jobs/job-1/mask/1',
            mesh_url: '/jobs/job-1/mesh/1',
          },
        ],
        warnings: [],
      },
    };

    renderWithQuery(<MeshViewer series={ctSeries} studyUid="1.2.3" />);

    await waitFor(() =>
      expect(mocks.fetchMesh).toHaveBeenCalledWith('job-1', 1, 'vtp'),
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(mocks.setVisibility).toHaveBeenLastCalledWith(1, false);
    fireEvent.click(checkbox);
    expect(mocks.setVisibility).toHaveBeenLastCalledWith(1, true);
  });
});

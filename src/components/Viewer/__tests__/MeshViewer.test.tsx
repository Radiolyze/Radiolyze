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
  enableClipPlane: vi.fn(),
  setClipPlanePosition: vi.fn(),
  getClipPlaneRange: vi.fn(() => [-50, 50] as [number, number]),
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
    enableClipPlane: mocks.enableClipPlane,
    setClipPlanePosition: mocks.setClipPlanePosition,
    getClipPlaneRange: mocks.getClipPlaneRange,
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

  it('lazy-loads only the top-N labels for a large multi-organ manifest', async () => {
    const labels = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `organ_${i + 1}`,
      color: [0.5, 0.5, 0.5] as [number, number, number],
      volume_ml: 100 - i, // descending volume so id=1 is largest
      voxel_count: 1000,
      mask_url: `/m/${i + 1}`,
      mesh_url: `/x/${i + 1}`,
    }));
    mocks.segmentationState.status = {
      job_id: 'big-job',
      status: 'finished',
      progress: 1,
      preset: 'total',
      study_uid: 's',
      series_uid: 's.1',
      manifest: {
        job_id: 'big-job',
        preset: 'total',
        source: { study_uid: 's', series_uid: 's.1', modality: 'CT' },
        volume: { spacing: [1, 1, 1], origin: [0, 0, 0], direction: [], shape: [] },
        labels,
        warnings: [],
      },
    };

    renderWithQuery(<MeshViewer series={ctSeries} studyUid="1.2.3" />);

    // Only 10 (PREFETCH_TOP_N) labels should be pre-fetched, not all 25.
    await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalled());
    expect(mocks.fetchMesh).toHaveBeenCalledTimes(10);
    const fetchedIds = (mocks.fetchMesh.mock.calls as unknown[][])
      .map((call) => call[1] as number)
      .sort((a, b) => a - b);
    expect(fetchedIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('shows skeletons while the segmentation job is running', () => {
    mocks.segmentationState.status = {
      job_id: 'busy-job',
      status: 'running',
      progress: 0.4,
      preset: 'bone',
      study_uid: 's',
      series_uid: 's.1',
      manifest: null,
    };

    renderWithQuery(<MeshViewer series={ctSeries} studyUid="1.2.3" />);

    const loadingPanel = screen.getByRole('status');
    expect(loadingPanel).toHaveTextContent('mesh.skeleton.loading');
    // The label panel itself should not be in the DOM yet.
    expect(screen.queryByText('mesh.labels')).toBeNull();
  });

  it('shows a retry button when the job has failed', () => {
    mocks.segmentationState.status = {
      job_id: 'failed-job',
      status: 'failed',
      progress: 0,
      preset: 'bone',
      study_uid: 's',
      series_uid: 's.1',
      manifest: null,
      error: 'segmenter exploded',
    };

    renderWithQuery(<MeshViewer series={ctSeries} studyUid="1.2.3" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('segmenter exploded');
    const retryButtons = screen.getAllByRole('button', { name: 'mesh.retry' });
    expect(retryButtons.length).toBeGreaterThan(0);
    fireEvent.click(retryButtons[0]);
    expect(mocks.start).toHaveBeenCalledWith({
      studyUid: '1.2.3',
      seriesUid: 'series-1',
      preset: 'bone',
    });
  });

  it('shows a per-label retry button when a mesh fetch fails', async () => {
    let callCount = 0;
    mocks.fetchMesh.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error('network blip');
      }
      return new ArrayBuffer(8);
    });
    mocks.segmentationState.status = {
      job_id: 'lbl-fail-job',
      status: 'finished',
      progress: 1,
      preset: 'bone',
      study_uid: 's',
      series_uid: 's.1',
      manifest: {
        job_id: 'lbl-fail-job',
        preset: 'bone',
        source: { study_uid: 's', series_uid: 's.1', modality: 'CT' },
        volume: { spacing: [1, 1, 1], origin: [0, 0, 0], direction: [], shape: [] },
        labels: [
          {
            id: 1, name: 'bone',
            color: [0.93, 0.87, 0.74],
            volume_ml: 100, voxel_count: 1,
            mask_url: 'a', mesh_url: 'b',
          },
        ],
        warnings: [],
      },
    };

    renderWithQuery(<MeshViewer series={ctSeries} studyUid="1.2.3" />);

    const retry = await screen.findByRole('button', {
      name: /mesh\.retryLabel/,
    });
    expect(retry).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(2));
  });

  it('toggling the clip plane shows the position slider and forwards changes', async () => {
    mocks.segmentationState.status = {
      job_id: 'clip-job',
      status: 'finished',
      progress: 1,
      preset: 'bone',
      study_uid: 's',
      series_uid: 's.1',
      manifest: {
        job_id: 'clip-job',
        preset: 'bone',
        source: { study_uid: 's', series_uid: 's.1', modality: 'CT' },
        volume: { spacing: [1, 1, 1], origin: [0, 0, 0], direction: [], shape: [] },
        labels: [
          {
            id: 1, name: 'bone',
            color: [0.93, 0.87, 0.74],
            volume_ml: 100, voxel_count: 1,
            mask_url: 'a', mesh_url: 'b',
          },
        ],
        warnings: [],
      },
    };

    renderWithQuery(<MeshViewer series={ctSeries} studyUid="1.2.3" />);

    await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalled());
    const toggle = screen.getByRole('button', { name: 'mesh.clipPlane.toggle' });
    fireEvent.click(toggle);

    expect(mocks.enableClipPlane).toHaveBeenCalledWith(true, 'z');
    // Position slider appears once the plane is active.
    const slider = await screen.findByLabelText(/mesh\.clipPlane\.position/i);
    expect(slider).toBeInTheDocument();
  });

  it('filters labels via the search input', async () => {
    const labels = [
      { id: 1, name: 'spleen', color: [1, 0, 0] as [number, number, number],
        volume_ml: 80, voxel_count: 1, mask_url: 'a', mesh_url: 'b' },
      { id: 2, name: 'liver', color: [1, 0, 0] as [number, number, number],
        volume_ml: 1500, voxel_count: 1, mask_url: 'a', mesh_url: 'b' },
      ...Array.from({ length: 20 }, (_, i) => ({
        id: 3 + i, name: `rib_left_${i + 1}`,
        color: [0.9, 0.9, 0.7] as [number, number, number],
        volume_ml: 5, voxel_count: 1, mask_url: 'a', mesh_url: 'b',
      })),
    ];
    mocks.segmentationState.status = {
      job_id: 'search-job',
      status: 'finished',
      progress: 1,
      preset: 'total',
      study_uid: 's',
      series_uid: 's.1',
      manifest: {
        job_id: 'search-job',
        preset: 'total',
        source: { study_uid: 's', series_uid: 's.1', modality: 'CT' },
        volume: { spacing: [1, 1, 1], origin: [0, 0, 0], direction: [], shape: [] },
        labels,
        warnings: [],
      },
    };

    renderWithQuery(<MeshViewer series={ctSeries} studyUid="1.2.3" />);

    await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalled());
    expect(screen.getByText(/spleen/i)).toBeInTheDocument();
    expect(screen.getByText(/liver/i)).toBeInTheDocument();

    const searchBox = screen.getByPlaceholderText('mesh.search');
    fireEvent.change(searchBox, { target: { value: 'rib' } });

    expect(screen.queryByText(/spleen/i)).toBeNull();
    expect(screen.queryByText(/liver/i)).toBeNull();
    expect(screen.getAllByText(/rib left/i).length).toBeGreaterThan(0);
  });
});

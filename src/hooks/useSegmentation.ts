import { useCallback, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { segmentationClient } from '@/services/segmentationClient';
import type {
  SegmentationCreateInput,
  SegmentationJobResponse,
} from '@/types/segmentation';

interface UseSegmentationResult {
  jobId: string | null;
  status: SegmentationJobResponse | undefined;
  isStarting: boolean;
  start: (input: SegmentationCreateInput) => Promise<void>;
  reset: () => void;
  error: Error | null;
}

const POLL_INTERVAL_MS = 3000;

export function useSegmentation(): UseSegmentationResult {
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: SegmentationCreateInput) =>
      segmentationClient.createJob(input),
    onSuccess: (response) => {
      setJobId(response.job_id);
      setError(null);
    },
    onError: (err: Error) => setError(err),
  });

  const statusQuery = useQuery({
    queryKey: ['segmentation', jobId],
    queryFn: () => segmentationClient.getStatus(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const data = query.state.data as SegmentationJobResponse | undefined;
      if (!data) return POLL_INTERVAL_MS;
      return data.status === 'finished' || data.status === 'failed'
        ? false
        : POLL_INTERVAL_MS;
    },
  });

  const start = useCallback(
    async (input: SegmentationCreateInput) => {
      setError(null);
      await createMutation.mutateAsync(input);
    },
    [createMutation],
  );

  const reset = useCallback(() => {
    setJobId(null);
    setError(null);
  }, []);

  return {
    jobId,
    status: statusQuery.data,
    isStarting: createMutation.isPending,
    start,
    reset,
    error: error ?? (statusQuery.error as Error | null),
  };
}

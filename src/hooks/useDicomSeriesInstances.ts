import { useEffect, useState } from 'react';
import type { ImageRef, Series } from '@/types/radiology';
import {
  buildWadorsFrameUrl,
  buildWadorsImageId,
  buildWadorsRenderedFrameUrl,
  orthancClient,
} from '@/services/orthancClient';

type InstanceInfo = {
  instanceId: string;
  frames: number;
  instanceNumber?: number;
  pixelSpacing?: number[];
  sliceThickness?: number;
  spacingBetweenSlices?: number;
  imageOrientation?: number[];
  imagePosition?: number[];
};

const getTagValue = (entry: Record<string, unknown>, tag: string) => {
  const tagEntry = entry[tag] as { Value?: unknown[] } | undefined;
  if (tagEntry && Array.isArray(tagEntry.Value) && tagEntry.Value.length > 0) {
    return tagEntry.Value[0];
  }
  return undefined;
};

const getTagValues = (entry: Record<string, unknown>, tag: string) => {
  const tagEntry = entry[tag] as { Value?: unknown[] } | undefined;
  if (tagEntry && Array.isArray(tagEntry.Value) && tagEntry.Value.length > 0) {
    return tagEntry.Value;
  }
  return undefined;
};

const readNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readNumberArray = (values: unknown[] | undefined) => {
  if (!values) return undefined;
  const parsed = values
    .map(readNumber)
    .filter((entry): entry is number => typeof entry === 'number');
  return parsed.length > 0 ? parsed : undefined;
};

const getInstanceInfo = (entry: unknown): InstanceInfo | null => {
  if (typeof entry === 'string') {
    return { instanceId: entry, frames: 1 };
  }

  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const instanceId =
    (getTagValue(record, '00080018') as string | undefined) ||
    (record.SOPInstanceUID as string | undefined) ||
    (record.instanceId as string | undefined) ||
    (record.id as string | undefined) ||
    (record.ID as string | undefined);

  if (!instanceId) {
    return null;
  }

  const rawFrames =
    getTagValue(record, '00280008') ||
    record.numberOfFrames ||
    record.NumberOfFrames;
  const parsedFrames = readNumber(rawFrames);
  const frames = parsedFrames && parsedFrames > 1 ? parsedFrames : 1;

  const rawInstanceNumber =
    getTagValue(record, '00200013') ||
    record.InstanceNumber;
  const parsedInstanceNumber = readNumber(rawInstanceNumber);

  const pixelSpacing = readNumberArray(getTagValues(record, '00280030'));
  const sliceThickness = readNumber(getTagValue(record, '00180050'));
  const spacingBetweenSlices = readNumber(getTagValue(record, '00180088'));
  const imageOrientation = readNumberArray(getTagValues(record, '00200037'));
  const imagePosition = readNumberArray(getTagValues(record, '00200032'));

  return {
    instanceId,
    frames,
    instanceNumber: parsedInstanceNumber,
    pixelSpacing,
    sliceThickness,
    spacingBetweenSlices,
    imageOrientation,
    imagePosition,
  };
};

interface UseDicomSeriesInstancesResult {
  imageIds: string[];
  imageRefs: ImageRef[];
  isLoading: boolean;
  error: string | null;
}

export const useDicomSeriesInstances = (series: Series | null): UseDicomSeriesInstancesResult => {
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [imageRefs, setImageRefs] = useState<ImageRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!series) {
      setImageIds([]);
      setImageRefs([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;

    const loadInstances = async () => {
      setIsLoading(true);
      setError(null);
      setImageIds([]);
      setImageRefs([]);

      try {
        const response = await orthancClient.listInstances(series.studyId, series.id);
        const rawInstances = Array.isArray(response)
          ? response
          : Array.isArray((response as { Instances?: unknown[] }).Instances)
            ? (response as { Instances: unknown[] }).Instances
            : [];
        const parsed = rawInstances
          .map(getInstanceInfo)
          .filter((item): item is InstanceInfo => Boolean(item));

        if (parsed.length === 0) {
          throw new Error('Keine DICOM Instanzen gefunden');
        }

        parsed.sort((a, b) => {
          if (a.instanceNumber === undefined || b.instanceNumber === undefined) {
            return 0;
          }
          return a.instanceNumber - b.instanceNumber;
        });

        const ids: string[] = [];
        const refs: ImageRef[] = [];
        let stackIndex = 0;

        parsed.forEach((instance) => {
          for (let index = 0; index < instance.frames; index += 1) {
            const frameIndex = index + 1;
            const imageId = buildWadorsImageId(series.studyId, series.id, instance.instanceId, frameIndex);
            const wadoUrl = buildWadorsFrameUrl(series.studyId, series.id, instance.instanceId, frameIndex);
            const inferenceUrl = buildWadorsRenderedFrameUrl(series.studyId, series.id, instance.instanceId, frameIndex);
            ids.push(imageId);
            refs.push({
              studyId: series.studyId,
              seriesId: series.id,
              instanceId: instance.instanceId,
              frameIndex,
              stackIndex,
              wadoUrl,
              inferenceUrl,
              imageId,
              seriesDescription: series.seriesDescription,
              seriesModality: series.modality,
              instanceNumber: instance.instanceNumber,
              pixelSpacing: instance.pixelSpacing,
              sliceThickness: instance.sliceThickness,
              spacingBetweenSlices: instance.spacingBetweenSlices,
              imageOrientation: instance.imageOrientation,
              imagePosition: instance.imagePosition,
            });
            stackIndex += 1;
          }
        });

        if (isActive) {
          setImageIds(ids);
          setImageRefs(refs);
        }
      } catch (err) {
        console.warn('Failed to load DICOM instances', err);
        if (isActive) {
          setError('DICOM-Daten konnten nicht geladen werden.');
          setImageIds([]);
          setImageRefs([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadInstances();

    return () => {
      isActive = false;
    };
  }, [series]);

  return { imageIds, imageRefs, isLoading, error };
};

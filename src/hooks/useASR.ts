import { useState, useCallback, useRef } from 'react';
import type { ASRResult } from '@/types/radiology';
import { mockASRTranscripts } from '@/data/mockData';
import { useAudioInput } from '@/hooks/useAudioInput';
import { asrClient } from '@/services/asrClient';

type ASRStatus = 'idle' | 'listening' | 'processing';
const allowMockFallback = import.meta.env.VITE_ALLOW_MOCK_FALLBACK === 'true';

interface UseASRReturn {
  status: ASRStatus;
  isRecording: boolean;
  confidence: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<ASRResult | null>;
  lastResult: ASRResult | null;
}

interface UseASROptions {
  reportId?: string;
}

const buildMockResult = (durationMs: number): ASRResult => {
  const transcriptIndex = Math.floor(Math.random() * mockASRTranscripts.length);
  const mockConfidence = Math.min(0.98, 0.85 + (durationMs / 10000) * 0.13);

  return {
    text: mockASRTranscripts[transcriptIndex],
    confidence: mockConfidence,
    timestamp: new Date().toISOString(),
  };
};

export function useASR(options: UseASROptions = {}): UseASRReturn {
  const [status, setStatus] = useState<ASRStatus>('idle');
  const [confidence, setConfidence] = useState(0);
  const [lastResult, setLastResult] = useState<ASRResult | null>(null);
  const recordingStartTime = useRef<number>(0);
  const confidenceIntervalRef = useRef<number | null>(null);
  const useMockRecordingRef = useRef(false);
  const audioInput = useAudioInput();

  const clearConfidenceInterval = useCallback(() => {
    if (confidenceIntervalRef.current !== null) {
      clearInterval(confidenceIntervalRef.current);
      confidenceIntervalRef.current = null;
    }
  }, []);

  const startConfidenceInterval = useCallback(() => {
    clearConfidenceInterval();
    setConfidence(0);
    confidenceIntervalRef.current = window.setInterval(() => {
      setConfidence(prev => Math.min(prev + 0.1, 0.98));
    }, 500);
  }, [clearConfidenceInterval]);

  const startRecording = useCallback(async () => {
    if (status !== 'idle') return;

    useMockRecordingRef.current = false;
    recordingStartTime.current = Date.now();
    setStatus('listening');
    startConfidenceInterval();

    try {
      await audioInput.start();
    } catch (error) {
      if (allowMockFallback) {
        console.warn('ASR recording failed, using mock transcript.', error);
        useMockRecordingRef.current = true;
      } else {
        console.warn('ASR recording failed.', error);
        clearConfidenceInterval();
        setStatus('idle');
        setConfidence(0);
        useMockRecordingRef.current = false;
      }
    }
  }, [audioInput, clearConfidenceInterval, startConfidenceInterval, status]);

  const stopRecording = useCallback(async (): Promise<ASRResult | null> => {
    if (status !== 'listening') return null;

    clearConfidenceInterval();
    setStatus('processing');

    let result: ASRResult | null = null;
    const duration = Date.now() - recordingStartTime.current;

    if (!useMockRecordingRef.current) {
      const blob = await audioInput.stop().catch((error) => {
        console.warn('ASR stop failed, falling back to mock transcript.', error);
        return null;
      });

      if (blob) {
        try {
          result = await asrClient.transcribeAudio({ audio: blob, reportId: options.reportId });
        } catch (error) {
          console.warn('ASR service failed, falling back to mock transcript.', error);
        }
      }
    }

    if (!result) {
      if (allowMockFallback) {
        result = buildMockResult(duration);
      } else {
        console.warn('ASR failed and mock fallback is disabled.');
      }
    }

    setLastResult(result);
    setStatus('idle');
    if (!result) {
      setConfidence(0);
      return null;
    }
    setConfidence(result.confidence);

    return result;
  }, [audioInput, clearConfidenceInterval, options.reportId, status]);

  return {
    status,
    isRecording: status === 'listening',
    confidence,
    startRecording,
    stopRecording,
    lastResult,
  };
}

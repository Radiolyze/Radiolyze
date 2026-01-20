import { useState, useCallback, useRef } from 'react';
import type { ASRResult } from '@/types/radiology';
import { mockASRTranscripts } from '@/data/mockData';

type ASRStatus = 'idle' | 'listening' | 'processing';

interface UseASRReturn {
  status: ASRStatus;
  isRecording: boolean;
  confidence: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<ASRResult | null>;
  lastResult: ASRResult | null;
}

export function useASR(): UseASRReturn {
  const [status, setStatus] = useState<ASRStatus>('idle');
  const [confidence, setConfidence] = useState(0);
  const [lastResult, setLastResult] = useState<ASRResult | null>(null);
  const recordingStartTime = useRef<number>(0);

  const startRecording = useCallback(async () => {
    // In a real implementation, this would access the microphone
    // For mock, we just simulate the recording state
    setStatus('listening');
    setConfidence(0);
    recordingStartTime.current = Date.now();
    
    // Simulate confidence building up while recording
    const interval = setInterval(() => {
      setConfidence(prev => Math.min(prev + 0.1, 0.98));
    }, 500);

    // Store interval ID for cleanup
    (window as any).__asrInterval = interval;
  }, []);

  const stopRecording = useCallback(async (): Promise<ASRResult | null> => {
    // Clear the confidence interval
    if ((window as any).__asrInterval) {
      clearInterval((window as any).__asrInterval);
    }

    setStatus('processing');
    
    // Simulate processing delay (1-2 seconds)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // Calculate mock recording duration
    const duration = Date.now() - recordingStartTime.current;
    
    // Select a random transcript based on "recording duration"
    const transcriptIndex = Math.floor(Math.random() * mockASRTranscripts.length);
    
    // Generate mock confidence based on "duration" (longer = higher confidence)
    const mockConfidence = Math.min(0.98, 0.85 + (duration / 10000) * 0.13);
    
    const result: ASRResult = {
      text: mockASRTranscripts[transcriptIndex],
      confidence: mockConfidence,
      timestamp: new Date().toISOString(),
    };
    
    setLastResult(result);
    setConfidence(mockConfidence);
    setStatus('idle');
    
    return result;
  }, []);

  return {
    status,
    isRecording: status === 'listening',
    confidence,
    startRecording,
    stopRecording,
    lastResult,
  };
}

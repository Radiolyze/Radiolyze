import { useCallback, useRef, useState } from 'react';

type RecordingStatus = 'idle' | 'recording' | 'processing';

interface UseAudioInputReturn {
  status: RecordingStatus;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
}

export function useAudioInput(): UseAudioInputReturn {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    if (status !== 'idle') return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      chunksRef.current.push(event.data);
    };
    mediaRecorder.start();
    setStatus('recording');
  }, [status]);

  const stop = useCallback(async () => {
    if (!mediaRecorderRef.current || status !== 'recording') return null;

    setStatus('processing');
    const recorder = mediaRecorderRef.current;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const result = new Blob(chunksRef.current, { type: recorder.mimeType });
        resolve(result);
      };
      recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    });

    mediaRecorderRef.current = null;
    setStatus('idle');
    return blob;
  }, [status]);

  return { status, start, stop };
}

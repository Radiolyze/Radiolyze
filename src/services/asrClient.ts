import type { ASRResult } from '@/types/radiology';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const ASR_ENDPOINT = import.meta.env.VITE_ASR_ENDPOINT ?? '/api/v1/reports/asr-transcript';

const buildUrl = (path: string) => new URL(path, API_BASE_URL || window.location.origin).toString();

interface ASRServiceResponse {
  text?: string;
  transcript?: string;
  confidence?: number;
  timestamp?: string;
}

interface TranscribeOptions {
  audio: Blob;
  reportId?: string;
  /** BCP-47 locale passed to the ASR backend (e.g. de-DE, en-US). */
  language?: string;
}

export const asrClient = {
  async transcribeAudio({ audio, reportId, language }: TranscribeOptions): Promise<ASRResult> {
    const formData = new FormData();
    formData.append('file', audio, 'dictation.webm');
    if (reportId) {
      formData.append('report_id', reportId);
    }
    if (language) {
      formData.append('language', language);
    }

    const response = await fetch(buildUrl(ASR_ENDPOINT), {
      method: 'POST',
      body: formData,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMessage = typeof payload === 'string' ? payload : 'ASR request failed';
      throw new Error(errorMessage);
    }

    let text = '';
    let confidence = 0.9;
    let timestamp = new Date().toISOString();

    if (typeof payload === 'string') {
      text = payload.trim();
    } else if (payload && typeof payload === 'object') {
      const parsed = payload as ASRServiceResponse;
      text = (parsed.text ?? parsed.transcript ?? '').trim();
      if (typeof parsed.confidence === 'number') {
        confidence = parsed.confidence;
      }
      if (parsed.timestamp) {
        timestamp = parsed.timestamp;
      }
    }

    if (!text) {
      throw new Error('ASR response missing transcript');
    }

    return { text, confidence, timestamp };
  },
};

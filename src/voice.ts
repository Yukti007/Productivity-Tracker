import { useEffect, useRef, useState } from 'react';
import { TAGS, type Priority, type Tag } from './types';

// The Web Speech API isn't in TypeScript's DOM types yet; describe the parts we use.
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

const getCtor = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it in your browser’s site settings, then try again.',
  'service-not-allowed': 'Microphone access is blocked. Allow it in your browser’s site settings, then try again.',
  'no-speech': 'No speech heard. Tap the mic and say your task.',
  'audio-capture': 'No microphone found. Connect one and try again.',
  network: 'Voice input needs an internet connection in this browser.',
};

/** Dictation for a single task: interim text streams in, `final` marks the end of a phrase. */
export function useVoiceInput(onText: (text: string, final: boolean) => void) {
  const supported = typeof window !== 'undefined' && !!getCtor();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => () => rec.current?.abort(), []);

  const start = () => {
    const Ctor = getCtor();
    if (!Ctor || listening) return;
    const r = new Ctor();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onTextRef.current(text, e.results[e.results.length - 1].isFinal);
    };
    r.onerror = (e) => {
      if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'Voice input stopped. Tap the mic to try again.');
    };
    r.onend = () => setListening(false);
    rec.current = r;
    setError(null);
    try {
      r.start();
      setListening(true);
    } catch {
      setError('Voice input couldn’t start. Tap the mic to try again.');
    }
  };

  const stop = () => rec.current?.stop();

  return { supported, listening, error, start, stop };
}

const SPOKEN_PRIORITY = /\b(?:(high|medium|low)\s+priority|priority\s+(high|medium|low))\b/i;
const SPOKEN_TAGS = new RegExp(`\\b(?:tag|tagged|tags)\\s+((?:${TAGS.map((t) => t.id).join('|')})(?:\\s*(?:,|and)\\s*(?:${TAGS.map((t) => t.id).join('|')}))*)`, 'i');

/**
 * Pulls "high priority" and "tag work and family" out of dictated text,
 * and tidies the rest into a task name.
 */
export function parseSpoken(input: string): { title: string; tags: Tag[]; priority?: Priority } {
  let text = input;
  let priority: Priority | undefined;
  const tags: Tag[] = [];

  const p = text.match(SPOKEN_PRIORITY);
  if (p) {
    priority = (p[1] ?? p[2]).toLowerCase() as Priority;
    text = text.replace(p[0], ' ');
  }
  const t = text.match(SPOKEN_TAGS);
  if (t) {
    TAGS.forEach((tag) => new RegExp(`\\b${tag.id}\\b`, 'i').test(t[1]) && tags.push(tag.id));
    text = text.replace(t[0], ' ');
  }

  const title = text
    .replace(/\s+([,.])/g, '$1')
    .replace(/(^[\s,.]+)|([\s,.]+$)/g, '')
    .replace(/\s{2,}/g, ' ');
  return { title: title.charAt(0).toUpperCase() + title.slice(1), tags, priority };
}

"use client";

// Flow — Wispr-style push-to-talk, fully local. Hold Ctrl+Space anywhere,
// speak, release: Whisper (in a worker, WebGPU/WASM) transcribes on-device,
// then the words either land in the focused input (dictation) or run a
// dashboard command (tabs, modes, focus node, ask the brain, mute).

import { useEffect, useRef, useState } from "react";
import { useJarvis } from "@/lib/store";
import { routeCommand } from "@/lib/voice-commands";
import { sfx } from "@/lib/audio";

type FlowState =
  | { s: "idle" }
  | { s: "loading"; msg: string }
  | { s: "listening" }
  | { s: "transcribing" }
  | { s: "flash"; msg: string };

type MicVADLike = {
  start: () => void;
  pause: () => void;
};

const MIN_MS = 300;
const MIC_IDLE_RELEASE_MS = 60_000;
const WAKE_RE = /^\W*(?:hey |hej |ok |okay )?(?:jarvis|džarvis|jarwis)\b[\s,.:_-]*/i;
const ARMED_MS = 12_000;

function lang(): string {
  return useJarvis.getState().voiceLang === "sl-SI" ? "slovenian" : "english";
}

// idempotent script-tag loader for the self-contained VAD bundle
let vadScript: Promise<void> | null = null;
function loadVadScript(): Promise<void> {
  vadScript ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/vad/bundle.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("failed to load /vad/bundle.min.js"));
    document.head.appendChild(s);
  });
  return vadScript;
}

export default function Flow() {
  const [state, setState] = useState<FlowState>({ s: "idle" });
  const wakeMode = useJarvis((s) => s.wakeMode);
  const booted = useJarvis((s) => s.booted);
  const workerRef = useRef<Worker | null>(null);
  const vadRef = useRef<MicVADLike | null>(null);
  const armedUntilRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const micTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const holdingRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash(msg: string) {
    setState({ s: "flash", msg });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setState({ s: "idle" }), 2200);
  }

  function worker(): Worker {
    if (!workerRef.current) {
      // un-bundled on purpose — see the note at the top of the worker file
      const w = new Worker("/flow/whisper-worker.js", { type: "module" });
      w.onmessage = (e) => {
        const msg = e.data as
          | { type: "status"; message: string }
          | { type: "ready"; device: string }
          | { type: "result"; text: string; kind?: string; ts?: number }
          | { type: "error"; message: string; kind?: string };
        if (msg.type === "status") setState({ s: "loading", msg: msg.message });
        else if (msg.type === "ready") flash(`whisper ready · ${msg.device}`);
        else if (msg.type === "result") {
          if (msg.kind === "wake") {
            const m = msg.text.match(WAKE_RE);
            if (m) {
              const rest = msg.text.slice(m[0].length).trim();
              if (rest) {
                const did = routeCommand(rest, { dictate: false });
                flash(`"${rest.slice(0, 48)}" ${did}`);
                sfx.answerDone();
              } else {
                // bare "jarvis" — the next utterance is the command
                armedUntilRef.current = Date.now() + ARMED_MS;
                sfx.tick();
                flash("jarvis — listening for a command…");
              }
            } else if ((msg.ts ?? Date.now()) < armedUntilRef.current && msg.text) {
              armedUntilRef.current = 0;
              const did = routeCommand(msg.text, { dictate: false });
              flash(`"${msg.text.slice(0, 48)}" ${did}`);
              sfx.answerDone();
            }
            // not addressed to jarvis — stay silent
          } else if (!msg.text || /^\W*$/.test(msg.text)) {
            flash("…nothing heard");
          } else {
            const did = routeCommand(msg.text);
            flash(`"${msg.text.slice(0, 48)}" ${did}`);
            sfx.answerDone();
          }
        } else flash(`flow error: ${msg.message.slice(0, 80)}`);
      };
      workerRef.current = w;
      w.postMessage({ type: "load" });
    }
    return workerRef.current;
  }

  async function mic(): Promise<MediaStream> {
    if (micTimerRef.current) clearTimeout(micTimerRef.current);
    if (streamRef.current?.active) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    return stream;
  }
  function scheduleMicRelease() {
    if (micTimerRef.current) clearTimeout(micTimerRef.current);
    // keep the mic warm briefly so the next hold doesn't clip the first word
    micTimerRef.current = setTimeout(() => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }, MIC_IDLE_RELEASE_MS);
  }

  async function start() {
    if (holdingRef.current) return;
    holdingRef.current = true;
    worker(); // kick off model load in parallel with first recording
    try {
      const stream = await mic();
      if (!holdingRef.current) return scheduleMicRelease(); // released mid-permission
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => void finish();
      recRef.current = rec;
      // eslint-disable-next-line react-hooks/purity -- event-handler path, never runs during render
      startedAtRef.current = Date.now();
      rec.start();
      sfx.tick();
      setState({ s: "listening" });
    } catch {
      holdingRef.current = false;
      flash("microphone unavailable — check permission");
    }
  }

  function stop(cancelled = false) {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    const rec = recRef.current;
    if (!rec || rec.state === "inactive") return;
    if (cancelled || Date.now() - startedAtRef.current < MIN_MS) {
      rec.ondataavailable = null;
      rec.onstop = null;
      rec.stop();
      scheduleMicRelease();
      setState(cancelled ? { s: "idle" } : { s: "idle" });
      return;
    }
    sfx.tick();
    setState({ s: "transcribing" });
    rec.stop();
    scheduleMicRelease();
  }

  async function finish() {
    try {
      const blob = new Blob(chunksRef.current);
      const buf = await blob.arrayBuffer();
      // decode straight to 16 kHz mono — what Whisper expects
      const ctx = new AudioContext({ sampleRate: 16000 });
      const decoded = await ctx.decodeAudioData(buf);
      void ctx.close();
      let audio = decoded.getChannelData(0);
      if (decoded.numberOfChannels > 1) {
        const b = decoded.getChannelData(1);
        audio = audio.map((v, i) => (v + b[i]) / 2);
      }
      worker().postMessage(
        { type: "transcribe", audio, language: lang(), kind: "ptt" },
        [audio.buffer]
      );
    } catch (err) {
      flash(`audio decode failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // wake mode: Silero VAD segments speech continuously; every utterance is
  // transcribed locally and acted on only when it starts with "jarvis"
  useEffect(() => {
    if (!wakeMode || !booted) {
      vadRef.current?.pause();
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        if (!vadRef.current) {
          await loadVadScript();
          const MicVAD = (
            window as unknown as {
              vad?: { MicVAD: { new: (o: object) => Promise<MicVADLike> } };
            }
          ).vad?.MicVAD;
          if (!MicVAD) throw new Error("vad bundle missing MicVAD");
          const v = await MicVAD.new({
            baseAssetPath: "/vad/",
            onnxWASMBasePath: "/vad/",
            model: "v5",
            onSpeechEnd: (audio: Float32Array) => {
              if (holdingRef.current) return; // PTT owns this utterance
              worker().postMessage({
                type: "transcribe",
                audio,
                language: lang(),
                kind: "wake",
                // armed-window checks compare against when speech happened,
                // not when transcription finished
                ts: Date.now(),
              });
            },
          });
          if (cancelled) {
            v.pause();
            return;
          }
          vadRef.current = v;
        }
        vadRef.current.start();
        worker(); // preload whisper alongside
        flash("wake mode — say 'jarvis, …'");
      } catch (err) {
        flash(
          `wake mode failed: ${err instanceof Error ? err.message : err}`
        );
        useJarvis.getState().set({ wakeMode: false });
      }
    })();
    return () => {
      cancelled = true;
      vadRef.current?.pause();
    };
    // worker/flash are stable refs to component-scope fns
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeMode, booted]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.ctrlKey && !e.repeat && !e.altKey && !e.metaKey) {
        e.preventDefault();
        void start();
      }
      if (e.key === "Escape") stop(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "Control") stop();
    };
    const blur = () => stop(true);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    if (process.env.NODE_ENV === "development") {
      // dev-only test seam: feed PCM straight to the worker (no mic in headless)
      (window as unknown as Record<string, unknown>).__flowTest = (
        audio: Float32Array,
        language: string,
        kind: string = "ptt"
      ) => worker().postMessage({ type: "transcribe", audio, language, kind });
    }
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
    // handlers use refs only — safe to bind once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.s === "idle") return null;
  return (
    <div
      role="status"
      className="fixed bottom-16 left-1/2 z-50 -translate-x-1/2 border border-gold-border bg-panel px-4 py-2 font-mono text-xs text-ink"
    >
      {state.s === "listening" && (
        <span className="text-gold">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-gold" />
          LISTENING — release to send · Esc to cancel
        </span>
      )}
      {state.s === "transcribing" && (
        <span className="animate-pulse text-muted">transcribing locally…</span>
      )}
      {state.s === "loading" && <span className="text-muted">{state.msg}</span>}
      {state.s === "flash" && <span>{state.msg}</span>}
    </div>
  );
}

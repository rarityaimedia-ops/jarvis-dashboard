"use client";

// Query console: streaming answers, thinking-mode brain pulses, voice
// input (Web Speech), spoken answers (speechSynthesis), synth sounds.

import { useEffect, useRef, useState } from "react";
import { useJarvis } from "@/lib/store";
import { brainBus } from "@/lib/brain-bus";
import { sfx } from "@/lib/audio";

/* minimal Web Speech typings (not in lib.dom) */
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  }
}

const VOICE_NOTICE_KEY = "jarvis-voice-notice-shown";

export default function QueryBox() {
  const engine = useJarvis((s) => s.engine);
  const voiceLang = useJarvis((s) => s.voiceLang);
  const set = useJarvis((s) => s.set);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // voice flow: "ask <question>" submits through the console
  const askRef = useRef<(q?: string) => Promise<void>>(async () => {});
  useEffect(() => {
    askRef.current = ask;
  });
  useEffect(
    () =>
      brainBus.on("ask", ({ question }) => {
        setQuestion(question);
        void askRef.current(question);
      }),
    []
  );

  /* ---------- thinking mode: match streamed text → node pulses ---------- */
  function makeMatcher() {
    const graph = useJarvis.getState().graph;
    const pending = (graph?.nodes ?? [])
      .filter((n) => n.label.length >= 4)
      .map((n) => ({ label: n.label.toLowerCase(), id: n.id }));
    let fired = 0;
    return (fullText: string) => {
      if (fired >= 40) return;
      const t = fullText.toLowerCase();
      for (let i = pending.length - 1; i >= 0; i--) {
        if (t.includes(pending[i].label)) {
          brainBus.emit("pulse", { nodeId: pending[i].id });
          pending.splice(i, 1);
          if (++fired >= 40) break;
        }
      }
    };
  }

  /* ---------- ask ---------- */
  async function ask(q0?: string) {
    const q = (q0 ?? question).trim();
    if (!q || state === "loading") return;
    window.speechSynthesis?.cancel(); // auto-stop TTS on new query
    setSpeaking(false);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setAnswer("");
    setState("loading");
    set({ thinking: true });
    sfx.querySent();
    const match = makeMatcher();
    let full = "";
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, engine }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(`query failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setAnswer(full);
        match(full); // the brain thinks while the answer streams
      }
      setState("idle");
      sfx.answerDone();
      if (useJarvis.getState().speakAnswers && full.trim()) speak(full);
    } catch {
      if (!ac.signal.aborted) setState("error");
    } finally {
      set({ thinking: false });
    }
  }

  function stop() {
    abortRef.current?.abort();
    setState("idle");
    set({ thinking: false });
  }

  /* ---------- voice input ---------- */
  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setNotice("Speech recognition not available in this browser.");
      return;
    }
    if (!localStorage.getItem(VOICE_NOTICE_KEY)) {
      localStorage.setItem(VOICE_NOTICE_KEY, "1");
      setNotice(
        "Voice recognition uses the browser's cloud service — online required."
      );
    }
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = voiceLang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) setQuestion(interim);
      if (final) {
        setQuestion(final);
        void ask(final);
      }
    };
    rec.onerror = (e) => {
      setNotice(`voice input error: ${e.error}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    sfx.tick();
    rec.start();
    setListening(true);
  }

  /* ---------- voice output ---------- */
  function speak(text: string) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 3000));
    const wantSl = voiceLang === "sl-SI";
    const voices = synth.getVoices();
    const voice =
      (wantSl && voices.find((v) => v.lang.toLowerCase().startsWith("sl"))) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (wantSl && voice && !voice.lang.toLowerCase().startsWith("sl")) {
      setNotice("Slovenian voice not installed — using English.");
    }
    if (voice) u.voice = voice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  /* ---------- render ---------- */
  return (
    <section className="hud-panel">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline px-4 py-3">
        <input
          id="query-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          maxLength={300}
          placeholder={listening ? "listening…" : "Ask the company brain…"}
          className={`min-w-52 flex-1 border bg-bg-deep px-3.5 py-2 font-mono text-sm text-ink placeholder:text-muted focus:outline-none ${
            listening ? "border-gold" : "border-hairline focus:border-gold-border"
          }`}
        />
        <button
          onClick={toggleMic}
          title={`Voice input (${voiceLang})`}
          aria-pressed={listening}
          className={`border px-3 py-2 font-mono text-xs transition-colors ${
            listening
              ? "border-gold text-gold"
              : "border-hairline text-muted hover:text-ink"
          }`}
        >
          {listening ? "◉ REC" : "◎ MIC"}
        </button>
        <button
          onClick={() => {
            sfx.tick();
            set({ voiceLang: voiceLang === "sl-SI" ? "en-US" : "sl-SI" });
          }}
          title="Voice language"
          className="border border-hairline px-3 py-2 font-mono text-xs text-muted transition-colors hover:text-ink"
        >
          {voiceLang === "sl-SI" ? "SL" : "EN"}
        </button>
        <div className="flex font-mono text-xs">
          {(["graphify", "claude"] as const).map((e) => (
            <button
              key={e}
              onClick={() => {
                sfx.tick();
                set({ engine: e });
              }}
              title={e === "graphify" ? "Fast graph lookup" : "Deep answer (≤2 min)"}
              className={`border px-3 py-2 transition-colors ${
                engine === e
                  ? "border-gold-border bg-bg text-gold"
                  : "border-hairline text-muted hover:text-ink"
              }`}
            >
              {e === "graphify" ? "GRAPHIFY" : "CLAUDE"}
            </button>
          ))}
        </div>
        {state === "loading" ? (
          <button
            onClick={stop}
            className="border border-gold-border px-4 py-2 font-mono text-xs text-warning transition-colors hover:text-ink"
          >
            ABORT
          </button>
        ) : (
          <button
            onClick={() => ask()}
            className="border border-gold-border px-4 py-2 font-mono text-xs text-gold transition-colors hover:bg-bg"
          >
            ASK
          </button>
        )}
        {speaking && (
          <button
            onClick={stopSpeaking}
            className="border border-warning px-3 py-2 font-mono text-xs text-warning"
          >
            ■ VOICE
          </button>
        )}
      </div>
      {notice && (
        <p className="border-b border-hairline px-4 py-2 font-mono text-[11px] text-warning">
          {notice}
          <button
            onClick={() => setNotice(null)}
            className="ml-3 text-muted hover:text-ink"
          >
            dismiss
          </button>
        </p>
      )}
      {(answer || state !== "idle") && (
        <div className="px-4 py-3">
          {state === "error" && (
            <p className="font-mono text-xs text-warning">
              query failed — engine unavailable or crashed. Check the server log.
            </p>
          )}
          {state === "loading" && !answer && (
            <p className="animate-pulse font-mono text-xs text-muted">
              {engine === "claude"
                ? "claude is reading the vault…"
                : "querying graph…"}
            </p>
          )}
          {answer && (
            <pre className="max-h-72 overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">
              {answer}
              {state === "loading" && <span className="text-gold">▌</span>}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}

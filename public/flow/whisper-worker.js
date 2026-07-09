// Flow transcription worker — served un-bundled from /public on purpose:
// transformers.js stalls when bundled into a Turbopack worker. Everything
// it needs is same-origin (/flow/transformers.min.js, /ort/*), copied from
// node_modules by the predev script. Audio never leaves the machine.

import { pipeline, env } from "/flow/transformers.min.js";

// ponytail: one constant — bump to whisper-small if Slovenian accuracy disappoints
const MODEL = "onnx-community/whisper-base";

if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = `${self.location.origin}/ort/`;
}

self.addEventListener("error", (e) =>
  console.error("[flow-worker] uncaught:", e.message)
);
self.addEventListener("unhandledrejection", (e) =>
  console.error("[flow-worker] unhandled rejection:", e.reason)
);

let transcriber = null;
let loading = null;

async function pickDevice() {
  // "gpu" in navigator is not enough — software renderers expose the API
  // but stall in inference. Require a real hardware adapter.
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) return "wasm";
    const fallback =
      adapter.isFallbackAdapter ?? adapter.info?.isFallbackAdapter ?? false;
    if (fallback || /swiftshader|software/i.test(adapter.info?.vendor ?? ""))
      return "wasm";
    return "webgpu";
  } catch {
    return "wasm";
  }
}

async function load() {
  if (transcriber) return transcriber;
  loading ??= (async () => {
    const device = await pickDevice();
    console.log(`[flow-worker] device: ${device}`);
    const p = await pipeline("automatic-speech-recognition", MODEL, {
      device,
      // fp32 everywhere: the q8 decoder can't create a session on the
      // ort build transformers.js currently pins (MatMulNBits scale error)
      dtype: "fp32",
      progress_callback: (info) => {
        if (info.status === "progress") {
          self.postMessage({
            type: "status",
            message: `downloading ${MODEL.split("/")[1]} … ${Math.round(info.progress ?? 0)}%`,
          });
        }
      },
    });
    console.log(`[flow-worker] pipeline ready (${device})`);
    self.postMessage({ type: "ready", device });
    transcriber = p;
    return p;
  })();
  return loading;
}

// serialize: wake-mode utterances can arrive while a transcription runs
let queue = Promise.resolve();

self.onmessage = (e) => {
  const msg = e.data;
  queue = queue.then(async () => {
    try {
      if (msg.type === "load") {
        await load();
        return;
      }
      const t = await load();
      console.log(`[flow-worker] transcribing ${msg.audio.length} samples (${msg.language}, ${msg.kind})`);
      const out = await t(msg.audio, { language: msg.language, task: "transcribe" });
      const text = (Array.isArray(out) ? out[0].text : out.text).trim();
      console.log(`[flow-worker] result: ${text}`);
      self.postMessage({ type: "result", text, kind: msg.kind, ts: msg.ts });
    } catch (err) {
      self.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
        kind: msg.kind,
      });
    }
  });
};

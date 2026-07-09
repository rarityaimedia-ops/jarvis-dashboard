// Copy the un-bundled voice-flow runtime into /public (see
// public/flow/whisper-worker.js for why it lives outside the bundler).
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/flow", { recursive: true });
mkdirSync("public/ort", { recursive: true });
cpSync(
  "node_modules/@huggingface/transformers/dist/transformers.min.js",
  "public/flow/transformers.min.js"
);
for (const f of [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
]) {
  cpSync(`node_modules/onnxruntime-web/dist/${f}`, `public/ort/${f}`);
}

// wake-word VAD (Silero) — model + worklet + the ort build vad-web pins
mkdirSync("public/vad", { recursive: true });
const VAD = "node_modules/@ricky0123/vad-web";
for (const f of [
  "silero_vad_v5.onnx",
  "silero_vad_legacy.onnx",
  "vad.worklet.bundle.min.js",
  "bundle.min.js", // UMD build, loaded via script tag (bundler-proof)
]) {
  cpSync(`${VAD}/dist/${f}`, `public/vad/${f}`);
}
const vadOrt = `${VAD}/node_modules/onnxruntime-web/dist`;
for (const f of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  cpSync(`${vadOrt}/${f}`, `public/vad/${f}`);
}

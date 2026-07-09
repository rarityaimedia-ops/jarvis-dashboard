import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

export const VAULT = path.resolve(process.env.VAULT_PATH ?? "");

/** Resolve a path inside the vault; throws if it escapes the vault root. */
export function vaultPath(rel: string): string {
  const p = path.resolve(VAULT, rel);
  if (p !== VAULT && !p.startsWith(VAULT + path.sep)) {
    throw new Error(`path escapes vault: ${rel}`);
  }
  return p;
}

/** Decode a vault file buffer; hermes logs are UTF-16LE with BOM. */
function decode(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString("utf16le").replace(/^﻿/, "");
  }
  return buf.toString("utf8").replace(/^﻿/, "");
}

const lastGood = new Map<string, string>();

/**
 * Read a vault file as text. On failure (Obsidian lock, mid-write) returns
 * the last successfully read content with stale=true instead of throwing.
 * Throws only if the file has never been read successfully.
 */
export async function readVaultFile(
  rel: string
): Promise<{ content: string; stale: boolean }> {
  const p = vaultPath(rel);
  try {
    const content = decode(await fs.readFile(p));
    lastGood.set(rel, content);
    return { content, stale: false };
  } catch (err) {
    const cached = lastGood.get(rel);
    if (cached !== undefined) return { content: cached, stale: true };
    throw err;
  }
}

export function tailLines(content: string, n: number): string[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.slice(-n);
}

/**
 * Run a command without a shell (spawn only — injection defense) and
 * collect its output. Never rejects; failures surface as code=null.
 */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {}
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let child;
    try {
      child = spawn(cmd, args, { cwd: opts.cwd, windowsHide: true });
    } catch (e) {
      resolve({ code: null, stdout: "", stderr: String(e) });
      return;
    }
    const timer = setTimeout(() => child.kill(), opts.timeoutMs ?? 15_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: null, stdout: out, stderr: err + String(e) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: out, stderr: err });
    });
  });
}

// Route a voice transcript to a dashboard action (en + sl keywords).
// Returns a short label of what happened, for the flow pill flash.

import { useJarvis } from "@/lib/store";
import { brainBus } from "@/lib/brain-bus";

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** best node whose label contains all spoken words (most specific wins) */
function findNode(query: string) {
  const nodes = useJarvis.getState().graph?.nodes ?? [];
  const words = norm(query).split(" ").filter(Boolean);
  if (!words.length) return null;
  let best: { id: string; label: string } | null = null;
  let bestLen = Infinity;
  for (const n of nodes) {
    const label = norm(n.label);
    if (words.every((w) => label.includes(w)) && label.length < bestLen) {
      best = n;
      bestLen = label.length;
    }
  }
  return best;
}

function fillQueryBox(text: string) {
  const el = document.getElementById("query-input") as HTMLInputElement | null;
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  setter?.call(el, text);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  return true;
}

/** insert transcript at the cursor of the focused editable (Wispr behavior) */
export function insertIntoActiveInput(text: string): boolean {
  const el = document.activeElement;
  if (
    !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) ||
    el.readOnly ||
    el.disabled
  )
    return false;
  const proto =
    el instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const pad = start > 0 && !/\s$/.test(el.value.slice(0, start)) ? " " : "";
  setter?.call(el, el.value.slice(0, start) + pad + text + el.value.slice(end));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const cursor = start + pad.length + text.length;
  el.setSelectionRange(cursor, cursor);
  return true;
}

export function routeCommand(
  raw: string,
  opts: { dictate?: boolean } = {}
): string {
  const t = norm(raw);
  const set = useJarvis.getState().set;

  // dictation first: if the user was in a text field, the words belong
  // there (skipped for wake-word commands — the user isn't at the keyboard)
  if (opts.dictate !== false && insertIntoActiveInput(raw.trim()))
    return "typed";

  if (/\b(wake|zbudi)\b.*\b(on|vklopi)\b|^wake mode$/.test(t)) {
    set({ wakeMode: true });
    return "wake mode ON — say 'jarvis …'";
  }
  if (/\b(wake|zbudi)\b.*\b(off|izklopi)\b|\b(sleep|spi)\b/.test(t)) {
    set({ wakeMode: false });
    return "wake mode off";
  }

  const tabWords: [RegExp, "brain" | "trading" | "ops", string][] = [
    [/\b(brain|možgani|graf|knowledge)\b/, "brain", "→ BRAIN"],
    [/\b(trading|trgovanje|trades?|pnl)\b/, "trading", "→ TRADING"],
    [/\b(ops|operacije|costs?|stroški|burn)\b/, "ops", "→ OPS"],
  ];

  // "ask/vprašaj <question>" → submit through the query console
  const ask = t.match(/^(?:ask|query|vprašaj)\s+(.+)/);
  if (ask) {
    set({ tab: "brain" });
    brainBus.emit("ask", { question: ask[1] });
    return `asking: ${ask[1].slice(0, 40)}…`;
  }

  // "focus/find/najdi/poišči <node>"
  const focus = t.match(/^(?:focus|find|najdi|poišči|show)\s+(?:node\s+)?(.+)/);
  if (focus) {
    const node = findNode(focus[1]);
    if (node) {
      set({ tab: "brain", mode: "brain" });
      brainBus.emit("flyTo", { nodeId: node.id });
      return `→ ${node.label}`;
    }
    // fall through: maybe it was a tab/mode word after "show"
  }

  for (const [re, tab, label] of tabWords) {
    if (re.test(t)) {
      set({ tab });
      return label;
    }
  }
  if (/\b(tactical|2d)\b/.test(t)) {
    set({ tab: "brain", mode: "tactical" });
    return "→ 2D tactical";
  }
  if (/\b(3d)\b/.test(t)) {
    set({ tab: "brain", mode: "brain" });
    return "→ 3D brain";
  }
  if (/\bgraphify\b/.test(t)) {
    set({ tab: "brain", mode: "graphify" });
    return "→ graphify";
  }
  if (/\b(mute|utišaj|tiho)\b/.test(t)) {
    set({ muted: true });
    return "muted";
  }
  if (/\b(unmute|zvok|sound on)\b/.test(t)) {
    set({ muted: false });
    return "sound on";
  }
  if (/\b(refresh|sync|osveži)\b/.test(t)) {
    useJarvis.getState().refreshGraph();
    return "graph sync";
  }

  // no command matched — put the words in the query box, ready to send
  set({ tab: "brain" });
  // input mounts with the tab switch
  setTimeout(() => fillQueryBox(raw.trim()), 50);
  return "→ query box";
}

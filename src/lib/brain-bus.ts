// Tiny pub-sub so the query stream / palette can poke the WebGL brain
// without any React state crossing the memo boundary.

type Events = {
  pulse: { nodeId: string };
  flyTo: { nodeId: string };
  clear: void;
  /** submit a question through the query console (voice flow) */
  ask: { question: string };
};

type Handler<K extends keyof Events> = (payload: Events[K]) => void;

// storage is type-erased; the public on/emit signatures keep callers safe
const handlers: Partial<Record<keyof Events, Set<Handler<never>>>> = {};

export const brainBus = {
  on<K extends keyof Events>(evt: K, h: Handler<K>): () => void {
    (handlers[evt] ??= new Set()).add(h);
    return () => handlers[evt]?.delete(h);
  },
  emit<K extends keyof Events>(evt: K, payload: Events[K]) {
    handlers[evt]?.forEach((h) => (h as Handler<K>)(payload));
  },
};

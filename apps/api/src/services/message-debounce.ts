import type { Redis } from "ioredis";
import type { ChatRequest } from "@realty/shared";

export type DebounceEnqueuePayload = ChatRequest;

export type DebounceWaitResult =
  | {
      process: true;
      merged: DebounceEnqueuePayload;
      waitedMs: number;
      reason: "ready";
      messageCount: number;
    }
  | {
      process: false;
      reason: "superseded" | "timeout";
      waitedMs: number;
    };

function bufKey(phone: string): string {
  return `debounce:buf:${phone}`;
}

function genKey(phone: string): string {
  return `debounce:gen:${phone}`;
}

function lastAtKey(phone: string): string {
  return `debounce:lastAt:${phone}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeChatPayloads(items: DebounceEnqueuePayload[]): DebounceEnqueuePayload {
  const last = items[items.length - 1];
  const texts = items
    .map((i) => i.message.trim())
    .filter((t) => t.length > 0 && t !== "[sem texto]");

  const message =
    texts.length > 1 ? texts.join("\n") : (texts[0] ?? last.message);

  let pushName: string | undefined;
  for (let i = items.length - 1; i >= 0; i--) {
    const name =
      items[i].metadata?.pushName ??
      items[i].metadata?.displayName ??
      items[i].metadata?.whatsappName;
    if (name?.trim()) {
      pushName = name.trim();
      break;
    }
  }

  return {
    ...last,
    message,
    messageId: last.messageId,
    metadata: {
      ...last.metadata,
      ...(pushName ? { pushName, displayName: pushName } : {}),
      debounced: true,
      debouncedMessageCount: items.length,
    },
  };
}

/**
 * Debounce por silêncio: só processa após `debounceMs` sem novas mensagens
 * do mesmo telefone (quem digita devagar não gera duas respostas).
 */
export async function waitDebounceAndMerge(params: {
  redis: Redis;
  phone: string;
  payload: DebounceEnqueuePayload;
  debounceMs: number;
  maxWaitMs?: number;
}): Promise<DebounceWaitResult> {
  const { redis, phone, payload } = params;
  const debounceMs = Math.min(Math.max(params.debounceMs, 500), 15_000);
  const maxWaitMs = Math.min(
    Math.max(
      params.maxWaitMs ?? Number(process.env.DEBOUNCE_MAX_WAIT_MS ?? 20_000),
      debounceMs + 2_000,
    ),
    30_000,
  );
  const pollMs = 400;
  const started = Date.now();
  const now = started;

  const myGen = await redis.incr(genKey(phone));
  await redis.rpush(bufKey(phone), JSON.stringify(payload));
  await redis.set(lastAtKey(phone), String(now), "EX", 120);
  await redis.expire(bufKey(phone), 120);
  await redis.expire(genKey(phone), 120);

  let ready = false;

  while (Date.now() - started < maxWaitMs) {
    await sleep(pollMs);

    const currentGen = Number(await redis.get(genKey(phone)));
    if (currentGen !== myGen) {
      return {
        process: false,
        reason: "superseded",
        waitedMs: Date.now() - started,
      };
    }

    const lastAt = Number(await redis.get(lastAtKey(phone)));
    const silence = Date.now() - (Number.isFinite(lastAt) ? lastAt : started);

    if (silence >= debounceMs) {
      ready = true;
      break;
    }
  }

  const waitedMs = Date.now() - started;

  if (!ready) {
    return { process: false, reason: "timeout", waitedMs };
  }

  const currentGen = Number(await redis.get(genKey(phone)));
  if (currentGen !== myGen) {
    return { process: false, reason: "superseded", waitedMs };
  }

  const rawItems = await redis.lrange(bufKey(phone), 0, -1);
  await redis.del(bufKey(phone), genKey(phone), lastAtKey(phone));

  if (rawItems.length === 0) {
    return { process: false, reason: "superseded", waitedMs };
  }

  const items: DebounceEnqueuePayload[] = [];
  for (const raw of rawItems) {
    try {
      items.push(JSON.parse(raw) as DebounceEnqueuePayload);
    } catch {
      /* ignore malformed */
    }
  }

  if (items.length === 0) {
    return { process: false, reason: "superseded", waitedMs };
  }

  const merged = mergeChatPayloads(items);

  return {
    process: true,
    merged,
    waitedMs,
    reason: "ready",
    messageCount: items.length,
  };
}

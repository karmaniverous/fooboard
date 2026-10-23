/**
 * Messages to the other open tabs (spec.md §3.4, Decision 38): a
 * BroadcastChannel named `fooboard` carrying removals and Reset, and
 * nothing else (configuration isn't synced). A removal names the
 * credentials whose queries every tab drops, so the tab that persists the
 * cache can't write them back; Reset makes every tab clear and reload.
 * Messages that don't parse are ignored. Where the browser has no
 * BroadcastChannel, nothing is sent or heard.
 *
 * @module
 */
import { z } from 'zod';

/** The channel's name. */
export const TAB_CHANNEL = 'fooboard';

const TabMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('remove'), credentialIds: z.array(z.string()) }),
  z.object({ type: z.literal('reset') }),
]);
export type TabMessage = z.infer<typeof TabMessageSchema>;

export interface TabChannel {
  /** Tell every other tab. */
  post(message: TabMessage): void;
  /** Hear what other tabs post. */
  subscribe(listener: (message: TabMessage) => void): () => void;
}

/** The part of BroadcastChannel the tab channel uses. */
export interface Broadcast {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
}

/** A channel that sends and hears nothing (one tab, or no support). */
export function silentTabChannel(): TabChannel {
  return {
    post: () => undefined,
    subscribe: () => () => undefined,
  };
}

/** The tab channel over a BroadcastChannel named `TAB_CHANNEL`. */
export function broadcastTabChannel(
  open: ((name: string) => Broadcast) | undefined = typeof BroadcastChannel ===
  'undefined'
    ? undefined
    : (name) => new BroadcastChannel(name),
): TabChannel {
  if (!open) return silentTabChannel();
  const channel = open(TAB_CHANNEL);
  const listeners = new Set<(message: TabMessage) => void>();
  channel.addEventListener('message', (e) => {
    const parsed = TabMessageSchema.safeParse(e.data);
    if (!parsed.success) return;
    for (const listener of listeners) listener(parsed.data);
  });
  return {
    post: (message) => {
      channel.postMessage(message);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

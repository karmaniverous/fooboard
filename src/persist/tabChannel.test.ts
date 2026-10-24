/**
 * Tests for the tab channel (spec.md §3.4, Decision 38): over a real
 * BroadcastChannel named `fooboard`, removals and Reset reach the other
 * tab, messages that aren't one of those are ignored, and an unsubscribed
 * listener hears nothing; without BroadcastChannel nothing is sent.
 *
 * @module
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type Broadcast,
  broadcastTabChannel,
  TAB_CHANNEL,
  type TabMessage,
} from './tabChannel';

const opened: BroadcastChannel[] = [];
const open = (name: string): Broadcast => {
  const channel = new BroadcastChannel(name);
  opened.push(channel);
  return channel;
};

afterEach(() => {
  for (const channel of opened.splice(0)) channel.close();
});

/** The next message `channel` hears. */
const next = (subscribe: (l: (m: TabMessage) => void) => () => void) =>
  new Promise<TabMessage>((resolve) => {
    const stop = subscribe((m) => {
      stop();
      resolve(m);
    });
  });

describe('broadcastTabChannel', () => {
  it('carries removals and Reset to the other tab', async () => {
    const mine = broadcastTabChannel(open);
    const theirs = broadcastTabChannel(open);
    const heard = next((l) => theirs.subscribe(l));
    mine.post({ type: 'remove', credentialIds: ['gh'] });
    expect(await heard).toEqual({ type: 'remove', credentialIds: ['gh'] });
    const reset = next((l) => theirs.subscribe(l));
    mine.post({ type: 'reset' });
    expect(await reset).toEqual({ type: 'reset' });
  });

  it('ignores anything else on the channel', async () => {
    const theirs = broadcastTabChannel(open);
    const heard = vi.fn();
    theirs.subscribe(heard);
    const raw = open(TAB_CHANNEL);
    raw.postMessage({ type: 'config', dashboards: [] });
    raw.postMessage('reset');
    const after = next((l) => theirs.subscribe(l));
    raw.postMessage({ type: 'reset' });
    await after;
    expect(heard.mock.calls).toEqual([[{ type: 'reset' }]]);
  });

  it('opens the browser’s BroadcastChannel named fooboard by default', () => {
    const made: string[] = [];
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor(name: string) {
          made.push(name);
        }
        postMessage = vi.fn();
        addEventListener = vi.fn();
      },
    );
    broadcastTabChannel().post({ type: 'reset' });
    expect(made).toEqual([TAB_CHANNEL]);
    vi.unstubAllGlobals();
  });

  it('sends nothing where the browser has no BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const channel = broadcastTabChannel();
    vi.unstubAllGlobals();
    const heard = vi.fn();
    channel.subscribe(heard)();
    channel.post({ type: 'reset' });
    expect(heard).not.toHaveBeenCalled();
  });
});

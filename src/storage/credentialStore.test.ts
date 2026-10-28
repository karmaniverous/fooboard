/**
 * Tests for what the credential store tells its subscribers (spec.md
 * §3.1, §3.4, Decision 27): a replaced secret, *Forget* and unticking
 * *Remember* say the credential's data must go; a first secret, the same
 * secret again and ticking *Remember* say it may stay.
 * A secret a tab keeps for itself is that tab's, whatever the device
 * holds; and a device that refuses to remove a secret leaves subscribers
 * told and the error saying how to clear it (fooboard#21).
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { CLEAR_EVERYTHING_STEPS, refusingDevice } from '@/test/refusingDevice';

import { createCredentialStore } from './credentialStore';
import { memoryStorage } from './keyValue';

const github = (token: string) => ({ kind: 'github' as const, token });

describe('credential changes', () => {
  it('say which changes drop the data read with the credential', () => {
    const store = createCredentialStore(memoryStorage());
    const heard = vi.fn();
    store.subscribe(heard);
    store.set('gh', github('a'), false); // a first secret
    store.set('gh', github('a'), true); // Remember ticked
    store.set('gh', github('a'), true); // the same again
    store.set('gh', github('a'), false); // Remember unticked
    store.set('gh', github('b'), false); // replaced
    store.forget('gh');
    store.forget('gh'); // nothing left: still drops, in case another tab holds it
    expect(heard.mock.calls).toEqual([
      ['gh', false],
      ['gh', false],
      ['gh', false],
      ['gh', true],
      ['gh', true],
      ['gh', true],
      ['gh', true],
    ]);
  });
});

describe('a secret this tab keeps for itself', () => {
  it('is not remembered here while another tab remembers one, and unticking Remember here drops that one', () => {
    const device = memoryStorage();
    const here = createCredentialStore(device);
    const there = createCredentialStore(device);
    here.set('gh', github('mine'), false);
    there.set('gh', github('mine'), true);
    expect(here.isRemembered('gh')).toBe(false);
    expect(here.rememberedFingerprint('gh')).toBeUndefined();
    expect(there.rememberedFingerprint('gh')).toBe(here.fingerprint('gh'));
    const heard = vi.fn();
    here.subscribe(heard);
    here.set('gh', github('mine'), false);
    expect(heard.mock.calls).toEqual([['gh', true]]);
    expect(there.get('gh')).toBeUndefined();
  });

  it("remembered over another tab's different secret, drops what was read with that one", () => {
    const device = memoryStorage();
    const here = createCredentialStore(device);
    const there = createCredentialStore(device);
    here.set('gh', github('mine'), false);
    there.set('gh', github('theirs'), true);
    const heard = vi.fn();
    here.subscribe(heard);
    here.set('gh', github('mine'), true);
    expect(heard.mock.calls).toEqual([['gh', true]]);
    expect(there.get('gh')).toEqual(github('mine'));
  });

  it('is copied for this tab only', () => {
    const device = memoryStorage();
    const here = createCredentialStore(device);
    here.set('gh', github('mine'), false);
    createCredentialStore(device).set('gh', github('mine'), true);
    here.copy('gh', 'copy');
    expect(here.isRemembered('copy')).toBe(false);
    expect(device.getItem('fooboard:credential:copy')).toBeNull();
  });
});

describe('a device that refuses to remove a secret (fooboard#21)', () => {
  it('keeps a secret for this tab only all the same: told, not remembered, never kept at rest, and how to clear what was left', () => {
    const { device, refuse } = refusingDevice();
    const store = createCredentialStore(device);
    store.set('gh', github('a'), true);
    const heard = vi.fn();
    store.subscribe(heard);
    refuse();
    const keepForThisTab = () => {
      store.set('gh', github('a'), false);
    };
    expect(keepForThisTab).toThrow(CLEAR_EVERYTHING_STEPS);
    expect(heard.mock.calls).toEqual([['gh', true]]);
    // It says what did happen, too.
    expect(keepForThisTab).toThrow(
      /this tab now keeps the secret for itself only/,
    );
    expect(store.get('gh')).toEqual(github('a'));
    expect(store.isRemembered('gh')).toBe(false);
    expect(store.rememberedFingerprint('gh')).toBeUndefined();
    // The leftover is still there: the error is what tells the user.
    expect(device.getItem('fooboard:credential:gh')).not.toBeNull();
  });
});

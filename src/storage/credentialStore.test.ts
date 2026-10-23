/**
 * Tests for what the credential store tells its subscribers (spec.md
 * §3.1, §3.4, Decision 27): a replaced secret, *Forget* and unticking
 * *Remember* say the credential's data must go; a first secret, the same
 * secret again and ticking *Remember* say it may stay.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

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

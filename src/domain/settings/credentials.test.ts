/**
 * Tests for naming a credential in messages: its label, else its id.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { credentialName } from './credentials';

describe('credentialName', () => {
  it('names a credential by its label, else by its id', () => {
    const d = {
      credentials: [{ id: 'k1', kind: 'aws' as const, label: 'prod' }],
    };
    expect(credentialName(d, 'k1')).toBe('prod');
    expect(credentialName(d, 'gone')).toBe('gone');
  });
});

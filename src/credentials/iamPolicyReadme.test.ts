/**
 * Docs sync: the README's AWS policy template is exactly the generated
 * policy with placeholders, so *Copy AWS policy* and the guide never
 * disagree (spec.md C-3a).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import readme from '../../README.md?raw';
import { policyTemplate } from './iamPolicy';

describe('README AWS policy template', () => {
  it('is the generated policy with placeholders', () => {
    const template = JSON.stringify(policyTemplate(), null, 2);
    expect(readme.replace(/\r\n/g, '\n')).toContain(
      '```json\n' + template + '\n```',
    );
  });
});

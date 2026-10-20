/**
 * Docs sync: the README's AWS policies are exactly the generated ones (the
 * account-wide policy, then the narrowed policy with placeholders), so
 * *Copy AWS policy* and the guide never disagree (spec.md C-3a).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import readme from '../../README.md?raw';
import { accountPolicy, policyTemplate } from './iamPolicy';

const FENCE = '```';

/** The JSON code blocks in the README's *AWS key* section. */
function awsKeyPolicies(): string[] {
  const text = readme.replace(/\r\n/g, '\n');
  const start = text.indexOf('\n### AWS key\n');
  const end = text.indexOf('\n### ', start + 1);
  const section = text.slice(start, end);
  const blocks = section.split(`${FENCE}json\n`).slice(1);
  return blocks.map((b) => b.slice(0, b.indexOf(`\n${FENCE}`)));
}

describe('README AWS policies', () => {
  it('are the generated account-wide policy and template, in order', () => {
    expect(awsKeyPolicies()).toEqual([
      JSON.stringify(accountPolicy(), null, 2),
      JSON.stringify(policyTemplate(), null, 2),
    ]);
  });

  it('leave out GetJob', () => {
    expect(awsKeyPolicies().join('\n')).not.toContain('GetJob');
  });
});

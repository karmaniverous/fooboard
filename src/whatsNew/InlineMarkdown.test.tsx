/**
 * A changelog line's inline Markdown (spec.md C-20): git-cliff's scopes,
 * breaking mark and PR links, with only `https:` links made links.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InlineMarkdown } from './InlineMarkdown';

const renderLine = (text: string) =>
  render(
    <p data-testid="line">
      <InlineMarkdown text={text} />
    </p>,
  );

describe('InlineMarkdown', () => {
  it("renders git-cliff's scope, breaking mark and PR link", () => {
    renderLine(
      '*(board)* [**breaking**] Gears ([#30](https://github.com/karmaniverous/fooboard/pull/30)) done',
    );
    const line = screen.getByTestId('line');
    expect(line).toHaveTextContent('(board) [breaking] Gears (#30) done');
    expect(screen.getByText('(board)').tagName).toBe('EM');
    expect(screen.getByText('breaking').tagName).toBe('STRONG');
    const link = screen.getByRole('link', { name: '#30' });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/karmaniverous/fooboard/pull/30',
    );
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders Markdown inside a link', () => {
    renderLine('[**Docs**](https://example.com/docs)');
    expect(
      screen.getByRole('link', { name: 'Docs' }).firstElementChild?.tagName,
    ).toBe('STRONG');
  });

  it.each([
    ['javascript:', '[click](javascript:alert(1))'],
    ['http:', '[plain](http://example.com)'],
    ['relative', '[here](/demo)'],
  ])('leaves a %s link as text', (_, text) => {
    renderLine(text);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByTestId('line')).toHaveTextContent(text);
  });

  it('leaves plain text as it is', () => {
    renderLine('Plain text, no marks');
    expect(screen.getByTestId('line').innerHTML).toBe('Plain text, no marks');
  });
});

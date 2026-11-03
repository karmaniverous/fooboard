import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEMO_PATH, HOME_PATH } from '@/pages/paths';

import { DEMO_HEAD, HEAD_META, HOME_HEAD, type PageHead } from './pageHead';
import { applyHead, useDocumentHead } from './useDocumentHead';

/** The head as the static page writes it: every tag, with stale values. */
function staticHead(): void {
  document.head.innerHTML = [
    '<title>stale</title>',
    '<link rel="canonical" href="https://stale.test/" />',
    ...HEAD_META.map(
      ({ attribute, key }) => `<meta ${attribute}="${key}" content="stale" />`,
    ),
  ].join('');
}

/** What the document's head says, as a {@link PageHead} would: each field
 * from every tag that carries it. */
function documentHead(): Record<string, string[]> {
  const read: Record<string, string[]> = {
    title: [document.title],
    url: [
      document.querySelector('link[rel="canonical"]')?.getAttribute('href') ??
        '',
    ],
  };
  for (const { attribute, key, field } of HEAD_META)
    (read[field] ??= []).push(
      document
        .querySelector(`meta[${attribute}="${key}"]`)
        ?.getAttribute('content') ?? '',
    );
  return read;
}

/** `head` as {@link documentHead} reads it once applied. */
const expected = (head: PageHead): Record<string, string[]> => ({
  title: [head.title, head.title, head.title],
  url: [head.url, head.url],
  description: [head.description],
  shareDescription: [head.shareDescription, head.shareDescription],
});

function Probe(): React.JSX.Element {
  useDocumentHead();
  const navigate = useNavigate();
  return (
    <>
      <Link to={DEMO_PATH}>demo</Link>
      <Link to={HOME_PATH}>home</Link>
      <Link to="/d/acme">board</Link>
      <button
        type="button"
        onClick={() => {
          navigate(-1);
        }}
      >
        back
      </button>
    </>
  );
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Probe />
    </MemoryRouter>,
  );

describe('useDocumentHead', () => {
  beforeEach(staticHead);
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it.each([
    ['/demo', DEMO_HEAD],
    ['/', HOME_HEAD],
    ['/d/acme', HOME_HEAD],
  ])('sets the head for %s on the first render', (path, head) => {
    renderAt(path);
    expect(documentHead()).toEqual(expected(head));
  });

  it('follows each move: home to the demo, to a board, and back', () => {
    renderAt(HOME_PATH);
    fireEvent.click(screen.getByRole('link', { name: 'demo' }));
    expect(documentHead()).toEqual(expected(DEMO_HEAD));
    fireEvent.click(screen.getByRole('link', { name: 'board' }));
    expect(documentHead()).toEqual(expected(HOME_HEAD));
    fireEvent.click(screen.getByRole('button', { name: 'back' }));
    expect(documentHead()).toEqual(expected(DEMO_HEAD));
    fireEvent.click(screen.getByRole('link', { name: 'home' }));
    expect(documentHead()).toEqual(expected(HOME_HEAD));
  });
});

describe('applyHead', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('sets the title of a page with none of the tags, adding none', () => {
    document.head.innerHTML = '';
    applyHead(document, DEMO_HEAD);
    expect(document.title).toBe(DEMO_HEAD.title);
    expect(document.head.querySelectorAll('meta, link')).toHaveLength(0);
  });
});

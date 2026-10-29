/**
 * Finds mojibake: UTF-8 text that was read as Windows-1252 and saved back
 * as UTF-8 (PowerShell's default `Get-Content`/`Set-Content` round trip),
 * which turns `×` into `Ã—`, `…` into `â€¦` and `📷` into `ðŸ“·`, and can
 * leave raw C1 control characters. Pure.
 *
 * @module
 */

/** The first and last byte a UTF-8 continuation byte can be. */
const CONTINUATION_BYTES = { first: 0x80, last: 0xbf } as const;

const windows1252 = new TextDecoder('windows-1252');

/** The characters UTF-8's continuation bytes become when read as
 * Windows-1252 (Latin-1 plus the punctuation Windows puts at 0x80-0x9f;
 * the five bytes it leaves undefined decode to C1 controls), each escaped
 * for a regex character class. */
const continuationClass = Array.from(
  { length: CONTINUATION_BYTES.last - CONTINUATION_BYTES.first + 1 },
  (_, i) => {
    const ch = windows1252.decode(Uint8Array.of(CONTINUATION_BYTES.first + i));
    return `\\u${(ch.codePointAt(0) ?? 0).toString(16).padStart(4, '0')}`;
  },
).join('');

/** What the lead bytes of the commonest UTF-8 sequences become when read as
 * Windows-1252: `Â` and `Ã` (U+0080-U+00FF), `â` (punctuation, arrows and
 * symbols, U+2000-U+2FFF) and `ð` (emoji). Other lead bytes decode to
 * accented letters that real prose may follow with punctuation. */
const LEAD_CHARS = 'ÂÃâð';

/** A mojibake sequence, or a C1 control character on its own. */
const MOJIBAKE = new RegExp(
  `[${LEAD_CHARS}][${continuationClass}]|[\\u0080-\\u009f]`,
  'gu',
);

/** The mojibake sequences in `text`, in order. */
export const mojibakeIn = (text: string): string[] =>
  text.match(MOJIBAKE) ?? [];

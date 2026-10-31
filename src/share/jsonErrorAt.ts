/**
 * Where text stops being JSON (spec 0.2.0 §3.J *No quoted input in error
 * messages*): the offset of the first character a JSON parser would
 * refuse, found by scanning the text against JSON's grammar, so a "not
 * JSON" message can give the position without quoting any of the text.
 * Engines word their errors differently and some quote the input; this
 * reads none of their words. Pure.
 *
 * @module
 */

/** Thrown inside the scan at the offset of the first refused character. */
class Refused extends Error {
  readonly at: number;

  constructor(at: number) {
    super(`not JSON at ${String(at)}`);
    this.at = at;
  }
}

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);
const ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't']);
const DIGIT = /[0-9]/;
const HEX = /[0-9a-fA-F]/;

/** A scanner over `text`: each method moves past one grammar item or
 * throws `Refused` at the first character that can't belong to it. */
class Scanner {
  i = 0;

  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  private at(): string | undefined {
    return this.text[this.i];
  }

  private refuse(): never {
    throw new Refused(this.i);
  }

  private expect(char: string): void {
    if (this.at() !== char) this.refuse();
    this.i += 1;
  }

  space(): void {
    while (WHITESPACE.has(this.at() ?? '')) this.i += 1;
  }

  private digits(): void {
    if (!DIGIT.test(this.at() ?? '')) this.refuse();
    while (DIGIT.test(this.at() ?? '')) this.i += 1;
  }

  private number(): void {
    if (this.at() === '-') this.i += 1;
    if (this.at() === '0') this.i += 1;
    else this.digits();
    if (this.at() === '.') {
      this.i += 1;
      this.digits();
    }
    if (this.at() === 'e' || this.at() === 'E') {
      this.i += 1;
      if (this.at() === '+' || this.at() === '-') this.i += 1;
      this.digits();
    }
  }

  private string(): void {
    this.expect('"');
    for (;;) {
      const char = this.at();
      if (char === undefined || char < ' ') this.refuse();
      this.i += 1;
      if (char === '"') return;
      if (char !== '\\') continue;
      const escape = this.at();
      if (escape === 'u') {
        this.i += 1;
        for (let n = 0; n < 4; n += 1) {
          if (!HEX.test(this.at() ?? '')) this.refuse();
          this.i += 1;
        }
      } else if (escape !== undefined && ESCAPES.has(escape)) this.i += 1;
      else this.refuse();
    }
  }

  private word(word: string): void {
    for (const char of word) this.expect(char);
  }

  /** The items of an array or object up to `close`, each read by `item`. */
  private items(close: string, item: () => void): void {
    this.i += 1;
    this.space();
    if (this.at() === close) {
      this.i += 1;
      return;
    }
    for (;;) {
      item();
      this.space();
      if (this.at() === close) {
        this.i += 1;
        return;
      }
      this.expect(',');
      this.space();
    }
  }

  value(): void {
    const char = this.at();
    if (char === '{')
      this.items('}', () => {
        this.string();
        this.space();
        this.expect(':');
        this.space();
        this.value();
      });
    else if (char === '[')
      this.items(']', () => {
        this.value();
      });
    else if (char === '"') this.string();
    else if (char === 't') this.word('true');
    else if (char === 'f') this.word('false');
    else if (char === 'n') this.word('null');
    else this.number();
  }
}

/** The offset of the first character in `text` that isn't JSON, or
 * `undefined` when the text is JSON (or nests too deeply to scan). */
export function jsonErrorAt(text: string): number | undefined {
  const scanner = new Scanner(text);
  try {
    scanner.space();
    scanner.value();
    scanner.space();
    return scanner.i < text.length ? scanner.i : undefined;
  } catch (err) {
    return err instanceof Refused ? err.at : undefined;
  }
}

/** `offset` in `text` as a 1-based line and column. */
export function lineColumn(
  text: string,
  offset: number,
): { line: number; column: number } {
  const before = text.slice(0, offset).split('\n');
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 };
}

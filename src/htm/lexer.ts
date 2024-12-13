export interface Token {
  type: TOKEN;
  value: any;
  line: number;
  column: number;
}

export enum TOKEN {
  OPEN_TAG,
  CLOSE_TAG,
  OPEN_CLOSING_TAG,
  CLOSING_SELF_TAG,
  TEXT,
  EOF,
  COMMENT_OPEN,
  COMMENT_CLOSE,
  WHITESPACE,
  ASSIGN,
  STRING,
  SPREAD,
  DYNAMIC,
}

export const DYNAMIC_PLACEHOLDER = "${...}";

const SPECIAL_CHARS = new Set(["<", ">", "/", "=", "-", '"', "'", ".", ""]);
const WHITESPACE_CHARS = new Set([" ", "\t", "\n", "\r"]);

class Lexer {
  private strings: TemplateStringsArray;
  private values: any[];
  private input = "";
  private index = 0;
  private pos = 0;
  private readPos = 0;
  private char = "";
  private line = 1;
  private column = 0;
  private tokenStartLine = 1;
  private tokenStartColumn = 0;

  constructor(strings: TemplateStringsArray, values: any[]) {
    this.strings = strings;
    this.values = values;
    this.feedInput();
  }

  private feedInput(): void {
    this.input =
      this.index < this.strings.length ? this.strings[this.index++] : "";
    this.pos = 0;
    this.readPos = 0;
    this.readChar();
  }

  private readChar(): string {
    if (this.readPos >= this.input.length) {
      this.char = "";
    } else {
      this.char = this.input[this.readPos];
    }

    this.pos = this.readPos;
    this.readPos++;

    if (this.char === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }

    return this.char;
  }

  private peekChar(lookAhead = 1): string {
    return this.input.slice(this.readPos, this.readPos + lookAhead);
  }

  private startToken() {
    this.tokenStartLine = this.line;
    this.tokenStartColumn = this.column;
  }

  public nextToken(): Token {
    let token: Token;
    this.startToken();

    switch (this.char) {
      case "<": {
        if (this.peekChar() === "/") {
          const value = this.char + this.readChar();
          token = this.createToken(TOKEN.OPEN_CLOSING_TAG, value);
        } else if (this.peekChar(3) === "!--") {
          const value =
            this.char + this.readChar() + this.readChar() + this.readChar();
          token = this.createToken(TOKEN.COMMENT_OPEN, value);
        } else {
          token = this.createToken(TOKEN.OPEN_TAG, this.char);
        }
        break;
      }

      case ">": {
        token = this.createToken(TOKEN.CLOSE_TAG, this.char);
        break;
      }

      case "/": {
        if (this.peekChar() === ">") {
          const value = this.char + this.readChar();
          token = this.createToken(TOKEN.CLOSING_SELF_TAG, value);
        } else {
          token = this.createToken(TOKEN.TEXT, this.char);
        }
        break;
      }

      case "=": {
        token = this.createToken(TOKEN.ASSIGN, this.char);
        break;
      }

      case "-": {
        if (this.peekChar(2) == "->") {
          const value = this.char + this.readChar() + this.readChar();
          token = this.createToken(TOKEN.COMMENT_CLOSE, value);
        } else {
          token = this.createToken(TOKEN.TEXT, this.char);
        }
        break;
      }

      case ".": {
        if (this.peekChar(2) === "..") {
          const value = this.char + this.readChar() + this.readChar();
          token = this.createToken(TOKEN.SPREAD, value);
        } else {
          token = this.createToken(TOKEN.TEXT, this.char);
        }
        break;
      }

      case '"':
      case "'":
        return this.readString(this.char);

      case "": {
        if (this.index < this.strings.length) {
          const dynamicValue = this.values[this.index - 1];
          this.feedInput();
          this.column += DYNAMIC_PLACEHOLDER.length;
          return this.createToken(TOKEN.DYNAMIC, dynamicValue);
        }
        token = this.createToken(TOKEN.EOF, "");
        break;
      }

      default: {
        if (this.isWhiteSpace()) {
          const pos = this.pos;
          while (this.isWhiteSpace()) this.readChar();
          const value = this.input.slice(pos, this.pos);
          token = this.createToken(TOKEN.WHITESPACE, value);
        } else {
          const pos = this.pos;
          while (!this.isWhiteSpace() && !SPECIAL_CHARS.has(this.char)) {
            this.readChar();
          }
          const value = this.input.slice(pos, this.pos);
          token = this.createToken(TOKEN.TEXT, value);
        }
        return token;
      }
    }

    this.readChar();
    return token;
  }

  private readString(quote: string): Token {
    const startPos = this.pos;

    this.readChar();

    while (this.char !== quote && this.char !== "") {
      this.readChar();
    }

    if (this.char === quote) {
      this.readChar();
    }

    const value = this.input.slice(startPos, this.pos);
    return this.createToken(TOKEN.STRING, value);
  }

  private createToken(type: TOKEN, value: any): Token {
    return {
      type,
      value,
      line: this.tokenStartLine,
      column: this.tokenStartColumn,
    };
  }

  private isWhiteSpace(): boolean {
    return WHITESPACE_CHARS.has(this.char);
  }
}

export default Lexer;

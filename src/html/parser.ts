import { ComponentFunction } from "../dom";
import { Props } from "../types";
import { Token } from "./lexer";

export type ASTNode = {
  type: string | ComponentFunction;
  props: Props;
  children: (ASTNode | string | null | boolean | number)[];
};

export const isASTNode = (value: any): value is ASTNode =>
  value &&
  typeof value === "object" &&
  "type" in value &&
  "props" in value &&
  "children" in value;

export default class HTMLParser {
  private tokens: Generator<Token>;
  private current: Token | null;
  private stack: (ASTNode | string)[];
  private template: string;

  constructor(lexer: Generator<Token>, template: string = "") {
    this.tokens = lexer;
    this.current = null;
    this.stack = [];
    this.template = template;
    this.advance();
  }

  private advance(): void {
    const next = this.tokens.next();
    this.current = next.done ? null : next.value;
  }

  parse(): ASTNode | string {
    while (this.current) this.parseToken();
    if (this.stack.length !== 1) {
      throw new Error(
        this.prettifyError(
          "Invalid HTML structure: multiple root elements or unclosed tags"
        )
      );
    }
    return this.stack[0];
  }

  private parseToken(): void {
    if (!this.current) return;
    switch (this.current.type) {
      case "LESS_THAN":
        this.parseOpeningTag();
        break;
      case "TEXT":
        this.parseText();
        break;
      case "INTERPOLATION":
        this.parseInterpolation();
        break;
      default:
        this.advance();
        break;
    }
  }

  private parseOpeningTag() {
    this.consume("LESS_THAN");

    if (this.match("FORWARD_SLASH")) {
      this.parseClosingTag();
      return;
    }

    if (!this.current)
      throw new Error(this.prettifyError("Unexpected end of input"));

    let type: string | ComponentFunction;
    if (this.is("INTERPOLATION")) {
      type = this.current.value as ComponentFunction;
      this.advance();
    } else {
      type = this.parseWord();
    }

    const props = this.parseProps();
    const isSelfClosing = this.match("FORWARD_SLASH");
    this.consume("GREATER_THAN");

    const element: ASTNode = { type, props, children: [] };

    if (!isSelfClosing) {
      this.stack.push(element);
    } else if (this.stack.length > 0) {
      this.appendChild(element);
    } else {
      this.stack.push(element);
    }
  }

  private parseProps(): Props {
    const props: Props = {};
    while (
      this.current &&
      this.current.type !== "GREATER_THAN" &&
      this.current.type !== "FORWARD_SLASH"
    ) {
      const name = this.parseWord();
      let value: any = true;
      if (this.match("EQUALS")) {
        value = this.parseAttributeValue();
      }
      if (!name) this.advance();
      else props[name] = value;
    }
    return props;
  }

  private parseAttributeValue(): any {
    if (this.match("QUOTE")) {
      return this.parseQuotedString();
    } else if (this.is("INTERPOLATION")) {
      const val = this.current!.value;
      this.advance();
      return val;
    } else {
      return this.parseWord();
    }
  }

  private parseQuotedString() {
    let text = "";
    while (this.current && this.current.type !== "QUOTE") {
      text += this.current.value;
      this.advance();
    }
    this.consume("QUOTE");
    return text;
  }

  private parseClosingTag() {
    if (this.match("FORWARD_SLASH")) {
      this.parseCustomElementClosingTag();
      return;
    }
    const tagName = this.parseWord();
    this.consume("GREATER_THAN");

    if (this.stack.length === 0) {
      throw new Error(
        this.prettifyError(`Unexpected closing tag </${tagName}>`)
      );
    }

    const openNode = this.stack.pop()!;

    if (!isASTNode(openNode))
      throw new Error(this.prettifyError("Invalid HTML structure"));

    const nodeType = typeof openNode.type;
    if (
      nodeType === "function" ||
      (nodeType === "string" && openNode.type !== tagName)
    ) {
      const expected = nodeType === "function" ? "/" : openNode.type;
      throw new Error(
        this.prettifyError(
          `Mismatched closing tag. Expected </${expected}>, but got </${tagName}>`
        )
      );
    }

    if (this.stack.length > 0) {
      this.appendChild(openNode);
    } else {
      this.stack.push(openNode);
    }
  }

  private parseWord(): string {
    let word = "";
    while (this.is("TEXT")) {
      word += this.current!.value;
      this.advance();
    }
    return word;
  }

  private parseCustomElementClosingTag() {
    this.consume("GREATER_THAN");
    if (this.stack.length === 0) {
      throw new Error(this.prettifyError(`Unexpected closing tag <//>`));
    }
    const openNode = this.stack.pop()!;

    if (!isASTNode(openNode))
      throw new Error(this.prettifyError("Invalid HTML structure"));

    if (typeof openNode.type !== "function") {
      throw new Error(
        this.prettifyError(
          `Mismatched closing tag. Expected Component, but got </${openNode.type}>`
        )
      );
    }

    if (this.stack.length > 0) {
      this.appendChild(openNode);
    } else {
      this.stack.push(openNode);
    }
  }

  private parseText(): void {
    let text = "";
    while (
      this.current &&
      ["TEXT", "WHITE_SPACE", "QUOTE"].includes(this.current.type)
    ) {
      text += this.current.value;
      this.advance();
    }
    text = text.trim();
    if (this.stack.length > 0 && text) {
      this.appendChild(text);
    } else {
      text && this.stack.push(text);
    }
  }

  private parseInterpolation(): void {
    if (!this.current) return;
    const value = this.current.value;
    this.advance();
    if (this.stack.length > 0) {
      this.appendChild(value);
    }
  }

  private is(type: Token["type"]) {
    return !!this.current && this.current.type === type;
  }

  private consume(type: Token["type"]): void {
    if (!this.current)
      throw new Error(
        this.prettifyError(
          `Expected token type ${type}, but reached end of input`
        )
      );
    if (this.current.type !== type)
      throw new Error(
        this.prettifyError(
          `Expected token ${type}, but got ${this.current.type}`
        )
      );
    this.advance();
  }

  private match(type: Token["type"]): boolean {
    if (this.is(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private appendChild(child: ASTNode | string) {
    const top = this.stack[this.stack.length - 1];
    if (!isASTNode(top))
      throw new Error(this.prettifyError(`Invalid HTML structure`));
    top.children.push(child);
  }

  private prettifyError(message: string): string {
    const lines = this.template.split("\n");
    const { line, column } = this.current
      ? this.current.position
      : { line: lines.length, column: lines[lines.length - 1].length };

    const errorLineIndex = line - 1;
    const startLine = Math.max(0, errorLineIndex - 2);
    const endLine = Math.min(lines.length, errorLineIndex + 3);

    const snippetLines = lines.slice(startLine, endLine);
    const errorLineInSnippet = errorLineIndex - startLine;

    const lineNumbers = Array.from(
      { length: endLine - startLine },
      (_, i) => startLine + i + 1
    );

    const maxLineNumberWidth = Math.max(...lineNumbers).toString().length;
    const lineNumberPadding = maxLineNumberWidth;

    const snippetWithLineNumbers = lineNumbers
      .map((num, index) => {
        const lineNumber = num.toString().padStart(maxLineNumberWidth);
        const codeLine = snippetLines[index];
        if (index === errorLineInSnippet) {
          const pointer = " ".repeat(lineNumberPadding + column - 1) + "^";
          return `${lineNumber} | ${codeLine}\n${" ".repeat(
            maxLineNumberWidth
          )}   ${pointer}`;
        }
        return `${lineNumber} | ${codeLine}`;
      })
      .join("\n");

    return `${message} at line ${line}, column ${column}\n\n${snippetWithLineNumbers}`;
  }
}

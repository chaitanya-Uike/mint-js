import { isFunction } from "../utils";
import { tokenMap } from "./lexer";
export const isASTNode = (value) => value &&
    typeof value === "object" &&
    "type" in value &&
    "props" in value &&
    "children" in value;
export default class HTMLParser {
    tokens;
    current;
    stack;
    template;
    constructor(lexer, template = "") {
        this.tokens = lexer;
        this.current = null;
        this.stack = [];
        this.template = template;
        this.advance();
    }
    advance() {
        const next = this.tokens.next();
        this.current = next.done ? null : next.value;
    }
    parse() {
        while (this.current)
            this.parseToken();
        if (this.stack.length !== 1) {
            throw new Error(this.prettifyError("Invalid HTML structure: multiple root elements or unclosed tags"));
        }
        return this.stack[0];
    }
    parseToken() {
        if (!this.current)
            return;
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
    parseOpeningTag() {
        this.consume("LESS_THAN");
        this.skipWhiteSpace();
        if (this.match("FORWARD_SLASH")) {
            this.parseClosingTag();
            return;
        }
        if (!this.current)
            throw new Error(this.prettifyError("Unexpected end of input"));
        let type;
        if (this.is("INTERPOLATION")) {
            type = this.current.value;
            this.advance();
        }
        else {
            type = this.parseWord();
        }
        this.skipWhiteSpace();
        const props = this.parseProps();
        this.skipWhiteSpace();
        const isSelfClosing = this.match("FORWARD_SLASH");
        this.skipWhiteSpace();
        this.consume("GREATER_THAN");
        const element = { type, props, children: [] };
        if (!isSelfClosing) {
            this.stack.push(element);
        }
        else if (this.stack.length > 0) {
            this.appendChild(element);
        }
        else {
            this.stack.push(element);
        }
    }
    parseProps() {
        const props = {};
        while (this.current &&
            this.current.type !== "GREATER_THAN" &&
            this.current.type !== "FORWARD_SLASH") {
            this.skipWhiteSpace();
            if (this.match("PERIOD")) {
                this.consume("PERIOD");
                this.consume("PERIOD");
                const value = this.consume("INTERPOLATION").value;
                if (typeof value !== "object" || value == null || Array.isArray(value))
                    throw new Error(this.prettifyError("Object expected"));
                Object.assign(props, value);
            }
            else {
                const name = this.parseWord();
                this.skipWhiteSpace();
                let value = true;
                if (this.match("EQUALS")) {
                    this.skipWhiteSpace();
                    value = this.parseAttributeValue();
                }
                if (!name)
                    this.advance();
                else
                    props[name] = value;
            }
            this.skipWhiteSpace();
        }
        return props;
    }
    parseAttributeValue() {
        if (this.match("QUOTE")) {
            return this.parseQuotedString();
        }
        else if (this.is("INTERPOLATION")) {
            const val = this.current.value;
            this.advance();
            return val;
        }
        else {
            return this.parseWord();
        }
    }
    parseQuotedString() {
        let text = "";
        while (this.current && this.current.type !== "QUOTE") {
            text += this.current.value;
            this.advance();
        }
        this.consume("QUOTE");
        return text;
    }
    parseClosingTag() {
        this.skipWhiteSpace();
        if (this.match("FORWARD_SLASH")) {
            this.parseCustomElementClosingTag();
            return;
        }
        let tag;
        if (this.is("INTERPOLATION")) {
            const value = this.consume("INTERPOLATION").value;
            if (!isFunction(value))
                throw new Error(this.prettifyError(`Expected a function recieved ${typeof value}`));
            tag = value;
        }
        else {
            tag = this.parseWord();
        }
        this.skipWhiteSpace();
        this.consume("GREATER_THAN");
        const tagName = isFunction(tag) ? tag.name : tag;
        if (this.stack.length === 0) {
            throw new Error(this.prettifyError(`Unexpected closing tag </${tagName}>`));
        }
        const openNode = this.stack.pop();
        if (!isASTNode(openNode))
            throw new Error(this.prettifyError("Invalid HTML structure"));
        const nodeType = typeof openNode.type;
        if (isFunction(openNode.type) && tagName !== openNode.type.name) {
            throw new Error(this.prettifyError(`Mismatched closing tag. Expected either <//> or </\${${openNode.type.name}}>`));
        }
        else if (nodeType === "string" && openNode.type !== tagName) {
            throw new Error(this.prettifyError(`Mismatched closing tag. Expected </${openNode.type}>, but got </${tagName}>`));
        }
        if (this.stack.length > 0) {
            this.appendChild(openNode);
        }
        else {
            this.stack.push(openNode);
        }
    }
    parseWord() {
        let word = "";
        while (this.is("TEXT")) {
            word += this.current.value;
            this.advance();
        }
        return word;
    }
    parseCustomElementClosingTag() {
        this.skipWhiteSpace();
        this.consume("GREATER_THAN");
        if (this.stack.length === 0) {
            throw new Error(this.prettifyError(`Unexpected closing tag <//>`));
        }
        const openNode = this.stack.pop();
        if (!isASTNode(openNode))
            throw new Error(this.prettifyError("Invalid HTML structure"));
        if (typeof openNode.type !== "function") {
            throw new Error(this.prettifyError(`Mismatched closing tag. Expected Component, but got </${openNode.type}>`));
        }
        if (this.stack.length > 0) {
            this.appendChild(openNode);
        }
        else {
            this.stack.push(openNode);
        }
    }
    parseText() {
        let text = "";
        while (this.current &&
            ["TEXT", "WHITE_SPACE", "QUOTE"].includes(this.current.type)) {
            text += this.current.value;
            this.advance();
        }
        if (this.stack.length > 0 && text) {
            this.appendChild(text);
        }
        else {
            text && this.stack.push(text);
        }
    }
    parseInterpolation() {
        if (!this.current)
            return;
        const value = this.current.value;
        this.advance();
        this.skipWhiteSpace();
        if (this.stack.length > 0) {
            this.appendChild(value);
        }
    }
    is(type) {
        return !!this.current && this.current.type === type;
    }
    consume(type) {
        if (!this.current)
            throw new Error(this.prettifyError(`Expected token type '${tokenMap[type]}', but reached end of input`));
        if (this.current.type !== type)
            throw new Error(this.prettifyError(`Expected token '${tokenMap[type]}', but got '${tokenMap[this.current.type]}'`));
        const token = this.current;
        this.advance();
        return token;
    }
    match(type) {
        if (this.is(type)) {
            this.advance();
            return true;
        }
        return false;
    }
    appendChild(child) {
        const top = this.stack[this.stack.length - 1];
        if (!isASTNode(top))
            throw new Error(this.prettifyError(`Invalid HTML structure`));
        top.children.push(child);
    }
    skipWhiteSpace() {
        while (this.match("WHITE_SPACE")) { }
    }
    prettifyError(message) {
        const lines = this.template.split("\n");
        const { line, column } = this.current
            ? this.current.position
            : { line: lines.length, column: lines[lines.length - 1].length };
        const errorLineIndex = line - 1;
        const startLine = Math.max(0, errorLineIndex - 2);
        const endLine = Math.min(lines.length, errorLineIndex + 3);
        const snippetLines = lines.slice(startLine, endLine);
        const errorLineInSnippet = errorLineIndex - startLine;
        const lineNumbers = Array.from({ length: endLine - startLine }, (_, i) => startLine + i + 1);
        const maxLineNumberWidth = Math.max(...lineNumbers).toString().length;
        const lineNumberPadding = maxLineNumberWidth;
        const snippetWithLineNumbers = lineNumbers
            .map((num, index) => {
            const lineNumber = num.toString().padStart(maxLineNumberWidth);
            const codeLine = snippetLines[index];
            if (index === errorLineInSnippet) {
                const pointer = " ".repeat(lineNumberPadding + column - 1) + "^";
                return `${lineNumber} | ${codeLine}\n${" ".repeat(maxLineNumberWidth)}   ${pointer}`;
            }
            return `${lineNumber} | ${codeLine}`;
        })
            .join("\n");
        return `${message} at line ${line}, column ${column}\n\n${snippetWithLineNumbers}`;
    }
}

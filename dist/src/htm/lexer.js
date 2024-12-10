import TAGS from "./tags";
export var TOKEN;
(function (TOKEN) {
    TOKEN[TOKEN["TAG_NAME"] = 0] = "TAG_NAME";
    TOKEN[TOKEN["OPEN_TAG"] = 1] = "OPEN_TAG";
    TOKEN[TOKEN["CLOSE_TAG"] = 2] = "CLOSE_TAG";
    TOKEN[TOKEN["OPEN_CLOSING_TAG"] = 3] = "OPEN_CLOSING_TAG";
    TOKEN[TOKEN["CLOSING_SELF_TAG"] = 4] = "CLOSING_SELF_TAG";
    TOKEN[TOKEN["TEXT"] = 5] = "TEXT";
    TOKEN[TOKEN["EOF"] = 6] = "EOF";
    TOKEN[TOKEN["COMMENT_OPEN"] = 7] = "COMMENT_OPEN";
    TOKEN[TOKEN["COMMENT_CLOSE"] = 8] = "COMMENT_CLOSE";
    TOKEN[TOKEN["WHITESPACE"] = 9] = "WHITESPACE";
    TOKEN[TOKEN["ASSIGN"] = 10] = "ASSIGN";
    TOKEN[TOKEN["QUOTE"] = 11] = "QUOTE";
    TOKEN[TOKEN["SPREAD"] = 12] = "SPREAD";
    TOKEN[TOKEN["DYNAMIC"] = 13] = "DYNAMIC";
})(TOKEN || (TOKEN = {}));
export const DYNAMIC_PLACEHOLDER = "${...}";
class Lexer {
    strings;
    values;
    input = "";
    index = 0;
    pos = 0;
    readPos = 0;
    char = "";
    line = 1;
    column = 0;
    constructor(strings, values) {
        this.strings = strings;
        this.values = values;
        this.feedInput();
    }
    feedInput() {
        this.input =
            this.index < this.strings.length ? this.strings[this.index++] : "";
        this.pos = 0;
        this.readPos = 0;
        this.readChar();
    }
    readChar() {
        if (this.readPos >= this.input.length) {
            this.char = "";
        }
        else {
            this.char = this.input[this.readPos];
            this.pos = this.readPos;
            this.readPos++;
            if (this.char === "\n") {
                this.line++;
                this.column = 1;
            }
            else {
                this.column++;
            }
        }
        return this.char;
    }
    peekChar(lookAhead = 1) {
        return this.input.slice(this.readPos, this.readPos + lookAhead);
    }
    nextToken() {
        let token;
        const line = this.line;
        const col = this.column;
        switch (this.char) {
            case "<": {
                if (this.peekChar() === "/") {
                    const value = this.char + this.readChar();
                    token = this.createToken(TOKEN.OPEN_CLOSING_TAG, value, line, col);
                }
                else if (this.peekChar(3) === "!--") {
                    const value = this.char + this.readChar() + this.readChar() + this.readChar();
                    token = this.createToken(TOKEN.COMMENT_OPEN, value, line, col);
                }
                else {
                    token = this.createToken(TOKEN.OPEN_TAG, this.char, line, col);
                }
                break;
            }
            case ">": {
                token = this.createToken(TOKEN.CLOSE_TAG, this.char, line, col);
                break;
            }
            case "/": {
                if (this.peekChar() === ">") {
                    const value = this.char + this.readChar();
                    token = this.createToken(TOKEN.CLOSING_SELF_TAG, value, line, col);
                }
                else {
                    token = this.createToken(TOKEN.TEXT, this.char, line, col);
                }
                break;
            }
            case "=": {
                token = this.createToken(TOKEN.ASSIGN, this.char, line, col);
                break;
            }
            case "-": {
                if (this.peekChar(2) == "->") {
                    const value = this.char + this.readChar() + this.readChar();
                    token = this.createToken(TOKEN.COMMENT_CLOSE, value, line, col);
                }
                else {
                    token = this.createToken(TOKEN.TEXT, this.char, line, col);
                }
                break;
            }
            case ".": {
                if (this.peekChar(2) === "..") {
                    const value = this.char + this.readChar() + this.readChar();
                    token = this.createToken(TOKEN.SPREAD, value, line, col);
                    break;
                }
                token = this.createToken(TOKEN.TEXT, this.char, line, col);
                break;
            }
            case '"': {
                token = this.createToken(TOKEN.QUOTE, this.char, line, col);
                break;
            }
            case "": {
                if (this.index < this.strings.length) {
                    const dynamicValue = this.values[this.index - 1];
                    this.feedInput();
                    this.column += DYNAMIC_PLACEHOLDER.length;
                    return this.createToken(TOKEN.DYNAMIC, dynamicValue, line, col);
                }
                token = this.createToken(TOKEN.EOF, this.char, line, col);
                break;
            }
            default: {
                if (this.isWhiteSpace()) {
                    const pos = this.pos;
                    while (this.isWhiteSpace())
                        this.readChar();
                    return this.createToken(TOKEN.WHITESPACE, this.input.slice(pos, this.pos), line, col);
                }
                else {
                    const pos = this.pos;
                    while (!this.isWhiteSpace() && !this.isSpecialChar())
                        this.readChar();
                    const value = this.input.slice(pos, this.pos);
                    if (TAGS[value])
                        return this.createToken(TOKEN.TAG_NAME, value, line, col);
                    return this.createToken(TOKEN.TEXT, value, line, col);
                }
            }
        }
        this.readChar();
        return token;
    }
    createToken(type, value, line, column) {
        return { type, value, line, column };
    }
    isWhiteSpace() {
        return [" ", "\t", "\n", "\r"].includes(this.char);
    }
    isSpecialChar() {
        return ["<", ">", "/", "=", "-", '"', ".", ""].includes(this.char);
    }
}
export default Lexer;

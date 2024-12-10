interface Token {
    type: TOKEN;
    value: any;
    line: number;
    column: number;
}
export declare enum TOKEN {
    TAG_NAME = 0,
    OPEN_TAG = 1,
    CLOSE_TAG = 2,
    OPEN_CLOSING_TAG = 3,
    CLOSING_SELF_TAG = 4,
    TEXT = 5,
    EOF = 6,
    COMMENT_OPEN = 7,
    COMMENT_CLOSE = 8,
    WHITESPACE = 9,
    ASSIGN = 10,
    QUOTE = 11,
    SPREAD = 12,
    DYNAMIC = 13
}
export declare const DYNAMIC_PLACEHOLDER = "${...}";
declare class Lexer {
    private strings;
    private values;
    private input;
    private index;
    private pos;
    private readPos;
    private char;
    private line;
    private column;
    constructor(strings: TemplateStringsArray, values: any[]);
    feedInput(): void;
    readChar(): string;
    peekChar(lookAhead?: number): string;
    nextToken(): Token;
    createToken(type: TOKEN, value: any, line: number, column: number): Token;
    isWhiteSpace(): boolean;
    isSpecialChar(): boolean;
}
export default Lexer;

import { ComponentFunction } from "../dom";
import { Props } from "../types";
import { Token } from "./lexer";
export type ASTNode = {
    type: string | ComponentFunction;
    props: Props;
    children: (ASTNode | string | null | boolean | number)[];
};
export declare const isASTNode: (value: any) => value is ASTNode;
export default class HTMLParser {
    private tokens;
    private current;
    private stack;
    private template;
    constructor(lexer: Generator<Token>, template?: string);
    private advance;
    parse(): ASTNode | string;
    private parseToken;
    private parseOpeningTag;
    private parseProps;
    private parseAttributeValue;
    private parseQuotedString;
    private parseClosingTag;
    private parseWord;
    private parseCustomElementClosingTag;
    private parseText;
    private parseInterpolation;
    private is;
    private consume;
    private match;
    private appendChild;
    private skipWhiteSpace;
    private prettifyError;
}

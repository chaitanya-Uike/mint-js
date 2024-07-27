import { Token } from "./lexer";
type Props = Record<string, any>;
export type Element = {
    type: string | Function;
    props: Props;
    children: (Element | string | null | boolean | number)[];
};
export default class HTMLParser {
    private tokens;
    private current;
    private stack;
    private template;
    constructor(lexer: Generator<Token>, template?: string);
    private advance;
    parse(): Element;
    private parseToken;
    private parseOpeningTag;
    private parseProps;
    private parseAttributeValue;
    private parseClosingTag;
    private parseWord;
    private parseCustomElementClosingTag;
    private parseText;
    private parseInterpolation;
    private consume;
    private match;
    private prettifyError;
}
export {};

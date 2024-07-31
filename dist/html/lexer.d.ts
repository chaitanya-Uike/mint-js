export default function lexer(strings: TemplateStringsArray, values: any[]): Generator<Token>;
export interface Token {
    type: "LESS_THAN" | "GREATER_THAN" | "FORWARD_SLASH" | "EQUALS" | "WHITE_SPACE" | "TEXT" | "QUOTE" | "INTERPOLATION" | "PERIOD";
    value: string | any;
    position: {
        line: number;
        column: number;
    };
}
export declare const tokenMap: Record<Token["type"], string>;

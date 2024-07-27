import HTMLParser from "./parser";
import lexer from "./lexer";
export function html(strings, ...values) {
    const tokens = lexer(strings, values);
    const template = getTemplate(strings, values);
    const parser = new HTMLParser(tokens, template);
    return parser.parse();
}
function getTemplate(strings, values) {
    return strings.reduce((acc, str, i) => acc + str + (i < values.length ? `\${${i}}` : ""), "");
}

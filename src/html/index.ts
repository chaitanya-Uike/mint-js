import HTMLParser, { Element } from "./parser";
import lexer from "./lexer";

export default function html(
  strings: TemplateStringsArray,
  ...values: any[]
): Element {
  const tokens = lexer(strings, values);
  const template = getTemplate(strings, values);
  const parser = new HTMLParser(tokens, template);
  return parser.parse();
}

function getTemplate(strings: TemplateStringsArray, values: any[]) {
  return strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `\${${i}}` : ""),
    ""
  );
}

import HTMLParser, { ASTNode, isASTNode } from "./parser";
import lexer from "./lexer";
import { component, createElement } from "../dom";

export function html(strings: TemplateStringsArray, ...values: any[]): Node {
  const tokens = lexer(strings, values);
  const template = getTemplate(strings, values);
  const parser = new HTMLParser(tokens, template);
  const ast = parser.parse();
  return renderAST(ast);
}

function renderAST(node: ASTNode | string): Node {
  if (typeof node === "string") return document.createTextNode(node);
  const { type, props } = node;
  const renderedChildren = props.children.map((child) =>
    isASTNode(child) ? renderAST(child) : child
  );

  return typeof type === "function"
    ? component(type, { ...props, children: renderedChildren })
    : createElement(type, { ...props, children: renderedChildren });
}

function getTemplate(strings: TemplateStringsArray, values: any[]) {
  return strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `\${${i}}` : ""),
    ""
  );
}

import HTMLParser, { ASTNode, isASTNode } from "./parser";
import lexer from "./lexer";
import { component, createElement } from "../dom";
import { isFunction } from "../utils";

export function html(strings: TemplateStringsArray, ...values: any[]): Node {
  const tokens = lexer(strings, values);
  const template = getTemplate(strings, values);
  const parser = new HTMLParser(tokens, template);
  const ast = parser.parse();
  return renderAST(ast);
}
function renderAST(node: ASTNode | string): Node {
  if (typeof node === "string") {
    return document.createTextNode(node);
  }

  const { type, props, children } = node;

  const renderedChildren = children.map((child) =>
    isASTNode(child) ? renderAST(child) : child
  );

  if (isFunction(type)) {
    return component(type)({ ...props, children: renderedChildren });
  }
  return createElement(type, props, ...renderedChildren);
}

function getTemplate(strings: TemplateStringsArray, values: any[]) {
  return strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `\${${i}}` : ""),
    ""
  );
}

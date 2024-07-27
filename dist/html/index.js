import HTMLParser, { isASTNode } from "./parser";
import lexer from "./lexer";
import { Component, createElement, isHTMLTagName } from "../dom";
import { isFunction } from "../utils";
export function html(strings, ...values) {
    const tokens = lexer(strings, values);
    const template = getTemplate(strings, values);
    const parser = new HTMLParser(tokens, template);
    const ast = parser.parse();
    return renderAST(ast);
}
function renderAST(node) {
    if (typeof node === "string") {
        return document.createTextNode(node);
    }
    const { type, props, children } = node;
    const renderedChildren = children.map((child) => isASTNode(child) ? renderAST(child) : child);
    if (isFunction(type)) {
        return Component(type)({ ...props, children: renderedChildren });
    }
    else if (isHTMLTagName(type)) {
        return createElement(type, props, ...renderedChildren);
    }
    else {
        throw new Error(`Invalid node type: ${type}`);
    }
}
function getTemplate(strings, values) {
    return strings.reduce((acc, str, i) => acc + str + (i < values.length ? `\${${i}}` : ""), "");
}

import { HTMLTagName } from "./types";

export const DISPOSE = Symbol("dispose_signal");
export const NODE = Symbol("node");
export const validTags: HTMLTagName[] = [
  "div",
  "span",
  "p",
  "a",
  "img",
  "button",
  "input",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "table",
  "tr",
  "td",
  "th",
  "form",
  "label",
];

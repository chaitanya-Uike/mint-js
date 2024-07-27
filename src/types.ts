import { Signal } from "./signals";

export type Props = Record<string, any>;
export type Child =
  | string
  | number
  | boolean
  | Node
  | Signal<any>
  | (() => Child)
  | Child[]
  | null
  | undefined;

type StyleValue = string | number | Signal<any> | (() => string | number);
export type StyleObject = Record<string, StyleValue>;

export type CreateElement = <K extends HTMLTagName>(
  name: K,
  ...args: [Props?, ...Child[]] | Child[]
) => HTMLElementTagNameMap[K];

export type Marker = Node | null;

export type HTMLTagName =
  | "div"
  | "span"
  | "p"
  | "a"
  | "img"
  | "button"
  | "input"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "ul"
  | "ol"
  | "li"
  | "table"
  | "tr"
  | "td"
  | "th"
  | "form"
  | "label";

export type TagsObject = {
  [K in HTMLTagName]: (...args: [Props?, ...Child[]] | Child[]) => HTMLElement;
};

export type HTMLElementTagNameMap = {
  div: HTMLDivElement;
  span: HTMLSpanElement;
  p: HTMLParagraphElement;
  a: HTMLAnchorElement;
  img: HTMLImageElement;
  button: HTMLButtonElement;
  input: HTMLInputElement;
  h1: HTMLHeadingElement;
  h2: HTMLHeadingElement;
  h3: HTMLHeadingElement;
  h4: HTMLHeadingElement;
  h5: HTMLHeadingElement;
  h6: HTMLHeadingElement;
  ul: HTMLUListElement;
  ol: HTMLOListElement;
  li: HTMLLIElement;
  table: HTMLTableElement;
  tr: HTMLTableRowElement;
  td: HTMLTableCellElement;
  th: HTMLTableCellElement;
  form: HTMLFormElement;
  label: HTMLLabelElement;
};

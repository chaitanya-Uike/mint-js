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

export type CreateElement = (
  name: string,
  ...args: [Props?, ...Child[]] | Child[]
) => HTMLElement;

export type Marker = Node | null;

type HTMLTagName =
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

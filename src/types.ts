import { Signal } from "./signals";

export type Props = Record<string, any>;
export type PrimitiveChild = string | number | boolean;
export type ChildFunction = () => Child | null;
export type Child =
  | Node
  | PrimitiveChild
  | null
  | undefined
  | Signal<PrimitiveChild>
  | ChildFunction
  | Child[];
export type Children = Child[];

type StyleValue = string | number | Signal<any> | (() => string | number);
export type StyleObject = Record<string, StyleValue>;

export type CreateElement = (
  name: string,
  ...args: [Props?, ...Children] | Children
) => HTMLElement;

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
  [K in HTMLTagName]: (
    ...args: [Props?, ...Children] | Children
  ) => HTMLElement;
};

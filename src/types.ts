import { Signal } from "./signals";

export type Props = Record<string, any> & { children: Child[] };
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
export type CreateElement = (type: string, props: Props) => Node;
export type ComponentFunction = (props: Props) => Node;

type StyleValue = string | number | Signal<any> | (() => string | number);
export type StyleObject = Record<string, StyleValue>;

export type Marker = Node | null;

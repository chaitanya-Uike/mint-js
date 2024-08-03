import { Signal } from "./signals";
export type Props = Record<string, any>;
export type Child = string | number | boolean | Node | Signal<any> | (() => Child) | Child[] | null | undefined;
type StyleValue = string | number | Signal<any> | (() => string | number);
export type StyleObject = Record<string, StyleValue>;
export type CreateElement = (name: string, ...args: [Props?, ...Child[]] | Child[]) => Node;
export type Marker = Node | null;
export type ComponentFunction = (props: Props, ...children: Child[]) => Node;
export {};

import type { Child, CreateElement, Props, TagsObject, HTMLTagName } from "./types";
export declare const createElement: CreateElement;
export declare const tags: TagsObject;
export type ComponentFunction = (props: Props, ...children: Child[]) => Node;
export declare function Component<P extends Props, C extends Child[]>(fn: (props: P, ...children: C) => Node): (props: P, ...children: C) => Node;
export declare function isHTMLTagName(value: any): value is HTMLTagName;

import type { Child, CreateElement, Props, TagsObject, HTMLTagName } from "./types";
export declare const createElement: CreateElement;
export declare const tags: TagsObject;
export type ComponentFunction = (props: Props, ...children: Child[]) => Node;
export declare function Component<P extends Props = {}>(fn: (props: P & {
    children?: Child[];
}) => Node): (props?: P & {
    children?: Child[];
}) => Node;
export declare function isHTMLTagName(value: any): value is HTMLTagName;

import type { Child, CreateElement, Props } from "./types";
export declare const createElement: CreateElement;
export declare function component(fn: (props: Props & {
    children: Child[];
}) => Node): (props: Props & {
    children: Child[];
}) => Node;

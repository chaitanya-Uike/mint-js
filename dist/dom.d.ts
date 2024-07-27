import type { Child, CreateElement, TagsObject } from "./types";
export declare const createElement: CreateElement;
export declare const tags: TagsObject;
export type FnType = (...args: any[]) => Child;
export declare function Component<T extends FnType>(fn: T): (...args: Parameters<T>) => ReturnType<T>;

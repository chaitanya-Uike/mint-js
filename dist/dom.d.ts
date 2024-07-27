import type { CreateElement, TagsObject } from "./types";
export declare const createElement: CreateElement;
export declare const tags: TagsObject;
export type FnType = (...args: any[]) => Node;
export declare function Component<T extends FnType>(fn: T): (...args: Parameters<T>) => ReturnType<T>;

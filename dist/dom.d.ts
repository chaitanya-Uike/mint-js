import type { Child, TagsObject } from "./types";
export declare const tags: TagsObject;
type FnType = (...args: any[]) => Child;
export declare function Component<T extends FnType>(fn: T): (...args: Parameters<T>) => ReturnType<T>;
export {};

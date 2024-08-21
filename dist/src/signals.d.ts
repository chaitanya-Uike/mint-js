import { ReactiveNode, ScopeNode } from "./core";
import { DISPOSE, NODE } from "./constants";
declare const SIGNAL: unique symbol;
export interface Signal<T = any> {
    (): T;
    set(value: T | ((prevVal: T) => void)): void;
    [SIGNAL]: boolean;
    [DISPOSE]: () => void;
    [NODE]: ReactiveNode<T>;
}
export declare function signal<T>(initValue: T | (() => T), label?: string): Signal<T>;
export declare function isSignal(value: any): value is Signal<any>;
export declare function memo<T>(fn: () => T): () => T;
export declare function createSignalWithinScope<T>(initValue: T | (() => T), scope?: ScopeNode, label?: string): Signal<T>;
export {};

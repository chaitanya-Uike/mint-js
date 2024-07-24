import { Reactive } from "./core";
declare const SIGNAL: unique symbol;
export interface Signal<T = any> {
    (): T;
    set(value: T | ((prevVal: T) => void)): void;
    [SIGNAL]: boolean;
    node: Reactive<T>;
}
export declare function signal<T>(initValue: T | (() => T)): Signal<T>;
export declare function isSignal(value: any): value is Signal<any>;
export declare function createEffect(fn: () => any | (() => void)): void;
export declare function createMemo<T>(fn: () => T): () => T;
export {};

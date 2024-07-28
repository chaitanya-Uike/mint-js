import { DISPOSE } from "./constants";
declare const SIGNAL: unique symbol;
export interface Signal<T = any> {
    (): T;
    set(value: T | ((prevVal: T) => void)): void;
    [SIGNAL]: boolean;
    [DISPOSE]: () => void;
}
export declare function signal<T>(initValue: T | (() => T)): Signal<T>;
export declare function isSignal(value: any): value is Signal<any>;
export declare function createEffect(fn: () => any | (() => void)): void;
export declare function createMemo<T>(fn: () => T): () => T;
export {};

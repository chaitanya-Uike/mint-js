import { DISPOSE } from "../constants";
import { Cleanup, Root } from "../core";
import { Signal } from "../signals";
import { SignalCache } from "./cache";
declare const CACHE: unique symbol;
declare const SCOPE: unique symbol;
export type Store<T extends object = object> = T & {
    [SCOPE]: Root;
    [CACHE]: SignalCache;
    [DISPOSE]: Cleanup;
    [key: PropertyKey]: any;
};
export type Reactive<T = any> = T extends Signal<any> ? T : T extends object ? Store<T> : Signal<T>;
export declare function isStore(value: unknown): value is Store;
export declare function store<T extends object>(initValue: T): Store<T>;
export {};

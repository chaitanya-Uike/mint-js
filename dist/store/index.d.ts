import { DISPOSE } from "../constants";
import { Cleanup, Root } from "../core";
import { Signal } from "../signals";
import { SignalCache } from "./cache";
declare const CACHE: unique symbol;
declare const SCOPE: unique symbol;
export type StoreMetadata = {
    [SCOPE]: Root;
    [CACHE]: SignalCache;
    [DISPOSE]: Cleanup;
};
export type Store<T = any> = T & StoreMetadata;
export type Reactive<T = any> = T extends Signal<any> ? T : T extends Array<infer U> ? Array<Reactive<U>> : T extends object ? Store<T> : Signal<T>;
export declare function isStore(value: unknown): value is Store;
export declare function store<T extends object | any[]>(initValue: T): Store<T>;
export {};

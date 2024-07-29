import { DISPOSE } from "../constants";
import { Root } from "../core";
import { SignalCache } from "./cache";
declare const STORE: unique symbol;
declare const SCOPE: unique symbol;
type DisposeFn = () => void;
export type Store<T extends object = any> = T & {
    [STORE]: SignalCache;
    [DISPOSE]: DisposeFn;
    [SCOPE]: Root | null;
};
export declare function isStore(value: any): value is Store<any>;
export declare function createStore<T extends object>(initialState: T): Store<T>;
export {};

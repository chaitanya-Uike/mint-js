import { DISPOSE } from "./constants";
declare const STORE: unique symbol;
declare const RAW: unique symbol;
type disposeFn = () => void;
export type Store<T extends object> = T & {
    [STORE]: Map<string, any>;
    [RAW]: T;
    [DISPOSE]: disposeFn;
};
export declare function isStore(value: any): value is Store<any>;
export declare function createStore<T extends object>(initialState: T): Store<T>;
export declare function unWrap<T extends object>(store: Store<T>): T;
export {};

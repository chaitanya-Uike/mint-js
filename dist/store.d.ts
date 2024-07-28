import { DISPOSE } from "./constants";
declare const STORE: unique symbol;
declare const RAW: unique symbol;
type disposeFn = () => void;
type Store<T extends object> = T & {
    [STORE]: Map<string, any>;
    [RAW]: T;
    [DISPOSE]: disposeFn;
};
export declare function createStore<T extends object>(initialState: T): Store<T>;
export {};

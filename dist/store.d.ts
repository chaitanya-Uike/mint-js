declare const STORE: unique symbol;
declare const RAW: unique symbol;
type Store<T extends object> = T & {
    [STORE]: Map<string, any>;
    [RAW]: T;
};
export declare function createStore<T extends object>(initialState: T): Store<T>;
export {};

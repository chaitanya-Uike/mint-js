type Store<T extends object> = T & {
    [STORE]?: boolean;
};
declare const STORE: unique symbol;
export declare function createStore<T extends object>(initialState: T): Store<T>;
export declare function isStore(value: any): value is Store<any>;
export {};

import { Signal } from "./signals";
type Unwrap<T> = T extends Signal<infer U> ? U : T;
export type Store<T extends object> = {
    [K in keyof T]: T[K] extends object ? Store<T[K]> : Signal<T[K]>;
};
type WritableStore<T extends object> = {
    [K in keyof T]: T[K] extends object ? WritableStore<T[K]> : Unwrap<T[K]>;
};
declare function createStore<T extends object>(initialState: T): WritableStore<T>;
export { createStore };

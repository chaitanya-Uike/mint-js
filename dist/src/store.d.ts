import { ScopeNode } from "./core";
import { NODE } from "./constants";
import { Signal } from "./signals";
declare const STORE: unique symbol;
type UnwrapSignal<T> = T extends Signal<infer U> ? U : T;
type DeepUnwrapSignals<T> = T extends object ? {
    [K in keyof T]: DeepUnwrapSignals<UnwrapSignal<T[K]>>;
} : UnwrapSignal<T>;
type StoreMetadata = {
    [STORE]: true;
    [NODE]: StoreNode;
};
export type Store<T extends object = {}> = DeepUnwrapSignals<T> & StoreMetadata;
type Reactive<T = any> = T extends object ? Store<T> : Signal<T>;
export declare class StoreNode extends ScopeNode {
    private objectCache;
    private arrayCache;
    constructor();
    get(key: PropertyKey): any;
    set(key: PropertyKey, value: Reactive): StoreNode;
    has(key: PropertyKey): boolean;
    delete(key: PropertyKey): boolean;
    updateScope(newScope: ScopeNode | null): void;
    dispose(): void;
    updateArrayCacheLength(newLength: number): void;
}
export declare function store<T extends object = {}>(initValue: T): Store<T>;
export declare function isStore(value: unknown): value is Store<any>;
export {};

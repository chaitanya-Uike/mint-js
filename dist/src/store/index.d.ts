import { ScopeNode } from "../core";
import { NODE } from "../constants";
import { Signal } from "../signals";
declare const STORE: unique symbol;
type StoreMetadata = {
    [STORE]: true;
    [NODE]: StoreNode;
};
export type Store<T extends object = {}> = T & StoreMetadata;
type Reactive<T = any> = T extends object ? Store<T> : Signal<T>;
declare class StoreNode extends ScopeNode {
    private objectCache;
    private arrayCache;
    constructor();
    get(key: PropertyKey): any;
    set(key: PropertyKey, value: Reactive): StoreNode;
    has(key: PropertyKey): boolean;
    delete(key: PropertyKey): boolean;
    updateScope(newScope: ScopeNode | null): void;
    dispose(): void;
}
export declare function store<T extends object = {}>(initValue: T): Store<T>;
export declare function isStore(value: unknown): value is Store;
export {};

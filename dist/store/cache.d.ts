import { Reactive } from ".";
export interface SignalCache {
    get(key: PropertyKey): Reactive | undefined;
    set(key: PropertyKey, newValue: Reactive): Reactive;
    delete(key: PropertyKey): void;
    has(key: PropertyKey): boolean;
    size(): number;
    clear(): void;
    [Symbol.iterator](): Iterator<[string, Reactive]>;
}
export declare function getSignalCache<T extends object>(initValue: T): SignalCache;

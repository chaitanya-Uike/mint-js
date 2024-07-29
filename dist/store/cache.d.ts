import { Store } from ".";
import { Signal } from "../signals";
type DisposeFn = () => void;
export interface SignalCache {
    get(key: string | number): Store | Signal | undefined;
    set(key: string | number, value: Store | Signal, disposeFn: DisposeFn): void;
    delete(key: string | number): void;
    has(key: string | number): boolean;
    size(): number;
    [Symbol.iterator](): Iterator<[string, Store | Signal]>;
}
export declare function getSignalCache<T extends object>(initialState: T): SignalCache;
export {};

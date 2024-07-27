interface Disposable {
    dispose: () => void;
}
declare enum CacheState {
    Clean = 0,
    Check = 1,
    Dirty = 2,
    Disposed = 3
}
type ComputeFn<T> = (prevVal?: T) => T;
type Cleanup = () => void;
export declare class Reactive<T = any> implements Disposable {
    private _value;
    private compute?;
    private _state;
    private effect;
    sources: Set<Reactive> | null;
    observers: Set<Reactive> | null;
    cleanups: Cleanup[] | null;
    constructor(initValue: (() => T) | T, effect?: boolean);
    get(): T;
    set(newVal: ComputeFn<T> | T): void;
    get state(): CacheState;
    private updateIfRequired;
    private update;
    private updateGraph;
    private notifyObservers;
    handleCleanup(): void;
    private stale;
    dispose(): void;
}
export declare function flush(): void;
export declare function effect(fn: () => any): void;
export declare function onCleanup(fn: Cleanup): void;
export declare function unTrack<T>(fn: () => T): T;
export declare function createRoot<T = any>(fn: (dispose: () => void) => T): T;
export {};

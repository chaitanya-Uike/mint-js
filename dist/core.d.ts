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
    private value;
    private compute?;
    private _state;
    private effect;
    private _scope;
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
    updateScope(newScope: Root | null): void;
}
export declare function flush(): void;
export declare function effect(fn: () => any): void;
export declare function onCleanup(fn: Cleanup): void;
export declare function unTrack<T>(fn: () => T): T;
export declare class Root<T = any> implements Disposable {
    private children;
    private parentScope;
    private disposed;
    private fn;
    constructor(fn: (dispose: () => void) => T);
    append(child: Disposable): void;
    dispose(): void;
    execute(): T;
    removeChild(child: Disposable): boolean;
}
export declare function createRoot<T = any>(fn: (dispose: () => void) => T): T;
export declare function getCurrentScope(): Root | null;
export declare function createReactive<T>(initValue: (() => T) | T, effect?: boolean, parentScope?: Root | null): Reactive<T>;
export {};

declare enum CacheState {
    Clean = 0,
    Check = 1,
    Dirty = 2
}
type ComputeFn<T> = (prevVal: T) => T;
type Cleanup = () => void;
export declare class Reactive<T> {
    private _value;
    private compute?;
    private _state;
    private effect;
    private deps;
    private observers;
    private _disposed;
    cleanups: Cleanup[];
    constructor(initValue: ComputeFn<T> | T, effect?: boolean);
    get(): T;
    set(newValue: ComputeFn<T> | T): void;
    get state(): CacheState;
    get disposed(): boolean;
    private updateIfRequired;
    private update;
    private updateGraph;
    private notifyObservers;
    handleCleanup(): void;
    removeDepObserver(index: number): void;
    private stale;
    dispose(): void;
}
export declare function effect(fn: () => any): void;
export declare function onCleanup(fn: Cleanup): void;
export declare function unTrack<T>(fn: () => T): T;
export declare function createRoot<T = any>(fn: () => T): [T, () => void];
export {};

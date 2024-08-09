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
export type Cleanup = () => void;
export declare class ReactiveNode<T = any> implements Disposable {
    private value;
    private compute?;
    private _state;
    private effect;
    private _scope;
    sources: Set<ReactiveNode> | null;
    observers: Set<ReactiveNode> | null;
    cleanups: Cleanup[] | null;
    constructor(initValue: (() => T) | T, effect?: boolean);
    get(): T;
    set(newVal: ComputeFn<T> | T): void;
    get state(): CacheState;
    get scope(): Root | null;
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
export declare function effect(fn: () => any | (() => void)): void;
export declare function onCleanup(fn: Cleanup): void;
export declare function unTrack<T>(fn: () => T): T;
export declare class Root implements Disposable {
    private children;
    private parentScope;
    private disposed;
    private context;
    constructor();
    append(child: Disposable): void;
    dispose(): void;
    execute<T>(fn: (dispose: () => void) => T): T;
    removeChild(child: Disposable): boolean;
    setContext(key: string, value: any): void;
    getContext(key: string): any;
}
export declare function createRoot<T = any>(fn: (dispose: () => void) => T): T;
export declare function getCurrentScope(): Root | null;
export declare function createReactive<T>(initValue: (() => T) | T, effect?: boolean, parentScope?: Root | null): ReactiveNode<T>;
export declare function setContext(key: string, value: any): void;
export declare function getContext(key: string): any;
export {};

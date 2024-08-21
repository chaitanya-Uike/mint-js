declare enum CacheState {
    Clean = 0,
    Check = 1,
    Dirty = 2
}
declare abstract class Disposable {
    protected _scope: ScopeNode | null;
    protected _disposed: boolean;
    constructor();
    dispose(): void;
    updateScope(newScope: ScopeNode | null): void;
    get scope(): ScopeNode | null;
    get disposed(): boolean;
}
export declare class ScopeNode extends Disposable {
    private children;
    constructor();
    dispose(): void;
    append(child: Disposable): void;
    remove(child: Disposable): void;
}
export type ComputeFn<T = any> = (prevVal: T) => T;
export type CleanupFn = () => void;
export declare class ReactiveNode<T = any> extends ScopeNode {
    private value;
    private compute?;
    private _state;
    private _effect;
    sources: Set<ReactiveNode> | null;
    observers: Set<ReactiveNode> | null;
    cleanups: CleanupFn[];
    label?: string;
    constructor(initValue: (() => T) | T, effect?: boolean, label?: string);
    get state(): CacheState;
    get effect(): boolean;
    get(): T;
    set(newValue: ((prevVal: T) => T) | T): void;
    updateIfRequired(): void;
    private update;
    private updateGraph;
    private notifyObservers;
    private stale;
    handleCleanup(): void;
    dispose(): void;
}
export declare function effect(fn: () => any | (() => void), label?: string): void;
export declare function createReactive<T>(initValue: (() => T) | T, effect?: boolean, scope?: ScopeNode | null, label?: string): ReactiveNode<T>;
export declare function unTrack<T>(fn: () => T): T;
export declare function createRoot<T = any>(fn: (dispose: () => void) => T): T;
export declare function onCleanup(fn: CleanupFn): void;
export declare function getCurrentScope(): ScopeNode | null;
export declare function flush(): void;
export {};

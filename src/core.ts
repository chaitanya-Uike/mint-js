import { isFunction } from "./utils";

let currentScope: ScopeNode | null = null;
let currentObserver: ReactiveNode | null = null;
let newSources: Set<ReactiveNode> | null = null;
let effectsQueue: ReactiveNode[] = [];
let effectsScheduled = false;

enum CacheState {
  Clean,
  Check,
  Dirty,
}

type CacheStale = CacheState.Check | CacheState.Dirty;

abstract class Disposable {
  protected _scope: ScopeNode | null;
  protected _disposed: boolean;

  constructor() {
    this._scope = currentScope;
    currentScope?.append(this);
    this._disposed = false;
  }

  dispose() {
    this._scope?.remove(this);
    this._disposed = true;
  }

  updateScope(newScope: ScopeNode | null) {
    if (newScope === this._scope) return;
    this._scope?.remove(this);
    this._scope = newScope;
    newScope?.append(this);
  }

  get scope() {
    return this._scope;
  }

  get disposed() {
    return this._disposed;
  }
}

export class ScopeNode extends Disposable {
  private children: Set<Disposable>;
  constructor() {
    super();
    this.children = new Set();
  }

  dispose(): void {
    if (this._disposed) return;
    for (const child of this.children) child.dispose();
    this.children.clear();
    super.dispose();
  }

  append(child: Disposable) {
    if (!this.disposed) this.children.add(child);
  }

  remove(child: Disposable) {
    this.children.delete(child);
  }
}

export function flush() {
  for (let i = 0; i < effectsQueue.length; i++) {
    let effect = effectsQueue[i];
    if (effect.state !== CacheState.Clean) {
      const effectsChain = [effect];
      effect.scope
    }
  }
  effectsScheduled = false;
}

function scheduleEffect(effect: ReactiveNode<any>) {
  effectsQueue.push(effect);
  if (!effectsScheduled) {
    effectsScheduled = true;
    queueMicrotask(flush);
  }
}

export type ComputeFn<T = any> = (prevVal: T) => T;
export type CleanupFn = () => void;

export class ReactiveNode<T = any> extends Disposable {
  private value: T;
  private compute?: (prevVal?: T) => T;
  private _state: CacheState;
  private effect: boolean;
  sources: Set<ReactiveNode> | null = null;
  observers: Set<ReactiveNode> | null = null;
  cleanups: CleanupFn[] = [];

  constructor(initValue: (() => T) | T, effect = false) {
    super();
    this.compute = isFunction(initValue) ? initValue : undefined;
    this._state = this.compute ? CacheState.Dirty : CacheState.Clean;
    this.value = this.compute ? (undefined as any) : initValue;
    this.effect = effect;
    if (effect) scheduleEffect(this);
  }

  get state() {
    return this._state;
  }

  get(): T {
    if (this.disposed) return this.value;
    if (!newSources) newSources = new Set();
    newSources.add(this);
    if (this.compute) this.updateIfRequired();
    return this.value;
  }

  set(newValue: ((prevVal: T) => T) | T) {
    if (isFunction(newValue)) {
      if (newValue !== this.compute) this.stale(CacheState.Dirty);
      this.compute = newValue as ComputeFn;
    } else {
      if (this.compute) {
        this.sources?.forEach((source) => source.observers?.delete(this));
        this.sources = null;
        this.compute = undefined;
      }
      if (newValue !== this.value) {
        this.value = newValue;
        this.notifyObservers(CacheState.Dirty);
      }
    }
  }

  private updateIfRequired() {
    if (this._state === CacheState.Check && this.sources) {
      for (const source of this.sources) {
        source.updateIfRequired();
        if ((this._state as CacheState) === CacheState.Dirty) {
          break;
        }
      }
    }
    if (this._state === CacheState.Dirty) this.update();
    this._state = CacheState.Clean;
  }

  private update() {
    const oldValue = this.value;
    this.handleCleanup();
    const fn = () => {
      const newValue = this.compute!(oldValue);
      this.updateGraph();
      return newValue;
    };
    this.value = execute(fn, this, this.scope);
    if (oldValue !== this.value && this.observers) {
      for (const observer of this.observers) {
        observer._state = CacheState.Dirty;
      }
    }
    this._state = CacheState.Clean;
  }

  private updateGraph(): void {
    const currentSources = this.sources || new Set<ReactiveNode>();
    const updatedSources = newSources || new Set<ReactiveNode>();
    // Remove this observer from sources that are no longer present
    for (const source of currentSources) {
      if (!updatedSources.has(source)) {
        source.observers?.delete(this);
      }
    }
    // Add this observer to new sources
    for (const source of updatedSources) {
      if (!currentSources.has(source)) {
        (source.observers ??= new Set()).add(this);
      }
    }
    this.sources = updatedSources;
  }

  private notifyObservers(state: CacheStale) {
    if (this.observers) {
      this.observers.forEach((observer) => observer.stale(state));
    }
  }

  private stale(newState: CacheStale) {
    if (
      this._state === CacheState.Clean ||
      (this._state === CacheState.Check && newState === CacheState.Dirty)
    ) {
      if (this._state === CacheState.Clean && this.effect) {
        scheduleEffect(this);
      }
      this._state = newState;
      this.notifyObservers(CacheState.Check);
    }
  }

  handleCleanup() {
    for (let i = this.cleanups.length - 1; i >= 0; i--) {
      this.cleanups[i]();
    }
    this.cleanups.length = 0;
  }

  dispose() {
    if (this.disposed) return;
    this.handleCleanup();
    if (this.sources) {
      for (const source of this.sources) {
        source.observers?.delete(this);
      }
    }
    this.sources = null;
    this.observers = null;
    super.dispose();
  }
}

function execute<T = any>(
  fn: () => T,
  observer: ReactiveNode | null,
  scope: ScopeNode | null
) {
  const prevObserver = currentObserver;
  const prevScope = currentScope;
  const prevSources = newSources;

  currentObserver = observer;
  currentScope = scope;
  newSources = null;

  try {
    return fn();
  } finally {
    currentObserver = prevObserver;
    currentScope = prevScope;
    newSources = prevSources;
  }
}

export function effect(fn: () => any | (() => void)) {
  const scope = new ScopeNode();
  onCleanup(() => scope.dispose());
  const computeFn = () => {
    const cleanup = fn();
    if (isFunction(cleanup)) onCleanup(cleanup);
  };
  const effectNode = createReactive(computeFn, true, scope);
  effectNode.get();
}

export function createReactive<T>(
  initValue: (() => T) | T,
  effect = false,
  scope?: ScopeNode | null
) {
  const executionScope = scope !== undefined ? scope : currentScope;
  return execute(
    () => new ReactiveNode(initValue, effect),
    currentObserver,
    executionScope
  );
}

export function unTrack<T>(fn: () => T): T {
  return execute(fn, null, currentScope);
}

export function createRoot<T = any>(fn: (dispose: () => void) => T): T {
  const scope = new ScopeNode();
  return execute(
    fn.bind(null, scope.dispose.bind(scope)),
    currentObserver,
    scope
  );
}

export function onCleanup(fn: CleanupFn) {
  if (currentObserver) currentObserver.cleanups.push(fn);
}

export function getCurrentScope() {
  return currentScope;
}

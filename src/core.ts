import { isFunction } from "./utils";

let currentObserver: ReactiveNode | null = null;
let newSources: Set<ReactiveNode> | null = null;
let effectsQueue: ReactiveNode[] = [];
let effectsScheduled = false;
interface Disposable {
  dispose: () => void;
}
let scope: Root | null = null;

enum CacheState {
  Clean,
  Check,
  Dirty,
  Disposed,
}

type CacheStale = CacheState.Check | CacheState.Dirty;

type ComputeFn<T> = (prevVal?: T) => T;
export type Cleanup = () => void;

export class ReactiveNode<T = any> implements Disposable {
  private value: T;
  private compute?: ComputeFn<T>;
  private _state: CacheState;
  private effect: boolean;
  private _scope: Root | null = null;
  sources: Set<ReactiveNode> | null = null;
  observers: Set<ReactiveNode> | null = null;

  cleanups: Cleanup[] | null = null;

  constructor(initValue: (() => T) | T, effect = false) {
    this.compute = isFunction(initValue) ? initValue : undefined;
    this._state = this.compute ? CacheState.Dirty : CacheState.Clean;
    this.value = this.compute ? (undefined as any) : initValue;
    this.effect = effect;
    if (effect) scheduleEffect(this);
    if (scope) {
      this._scope = scope;
      this._scope.append(this);
    }
  }

  get(): T {
    if (this.state === CacheState.Disposed) return this.value;
    if (!newSources) newSources = new Set();
    newSources.add(this);
    if (this.compute) this.updateIfRequired();
    return this.value;
  }

  set(newVal: ComputeFn<T> | T) {
    const nextVal = isFunction(newVal) ? newVal(this.value) : newVal;
    if (nextVal !== this.value) {
      this.value = nextVal;
      this.notifyObservers(CacheState.Dirty);
    }
  }

  get state() {
    return this._state;
  }

  get scope() {
    return this._scope;
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
    const context = suspendTracking(this);
    const oldValue = this.value;
    try {
      this.handleCleanup();
      this.value = this.compute!();
      this.updateGraph();
    } finally {
      resumeTracking(context);
    }
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

  handleCleanup() {
    if (this.cleanups) {
      for (let i = this.cleanups.length - 1; i >= 0; i--) {
        this.cleanups[i]();
      }
      this.cleanups = null;
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

  dispose() {
    if (this._state === CacheState.Disposed) return;
    console.log("reactive disposed", this);
    this._state = CacheState.Disposed;
    this.handleCleanup();
    if (this.sources) {
      for (const source of this.sources) {
        source.observers?.delete(this);
      }
    }
    this.sources = null;
    this.observers = null;
  }

  updateScope(newScope: Root | null) {
    if (newScope === this._scope) return;
    this._scope?.removeChild(this);
    this._scope = newScope;
    this._scope?.append(this);
  }
}

function suspendTracking(newObserver: ReactiveNode | null = null) {
  const currContext = {
    currentObserver,
    newSources: newSources,
    scope,
  };
  currentObserver = newObserver;
  newSources = null;
  if (newObserver && newObserver.scope !== undefined) scope = newObserver.scope;
  return currContext;
}

function resumeTracking(context: {
  currentObserver: ReactiveNode | null;
  newSources: Set<ReactiveNode> | null;
  scope: Root | null;
}) {
  ({ currentObserver, newSources, scope } = context);
}

export function flush() {
  for (let i = 0; i < effectsQueue.length; i++) {
    const effect = effectsQueue[i];
    if (effect.state !== CacheState.Clean) effectsQueue[i].get();
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

export function effect(fn: () => any | (() => void)) {
  const node = createReactive(() => {
    const cleanup = fn();
    if (typeof cleanup === "function") onCleanup(cleanup);
  }, true);
  node.get();
}

// should only be called inside an effect
export function onCleanup(fn: Cleanup) {
  if (currentObserver) {
    if (!currentObserver.cleanups) currentObserver.cleanups = [fn];
    else currentObserver.cleanups.push(fn);
  }
}

export function unTrack<T>(fn: () => T): T {
  const context = suspendTracking();
  try {
    return fn();
  } finally {
    resumeTracking(context);
  }
}

export class Root implements Disposable {
  private children: Set<Disposable>;
  private parentScope: Root | null;
  private disposed: boolean = false;
  private context: Record<PropertyKey, any> = {};

  constructor() {
    this.children = new Set();
    this.parentScope = scope;
    this.parentScope?.append(this);
  }

  append(child: Disposable) {
    if (!this.disposed) this.children.add(child);
  }

  dispose() {
    if (this.disposed) return;
    console.log("root disposed", this);
    for (const child of this.children) child.dispose();
    this.children.clear();
    this.parentScope?.children.delete(this);
    this.disposed = true;
  }

  execute<T>(fn: (dispose: () => void) => T) {
    scope = this;
    try {
      return fn(this.dispose.bind(this));
    } finally {
      scope = this.parentScope;
    }
  }

  removeChild(child: Disposable) {
    return this.children.delete(child);
  }

  setContext(key: PropertyKey, value: any) {
    this.context[key] = value;
  }

  getContext(key: PropertyKey): any {
    if (this.context[key] !== undefined) return this.context[key];
    return this.parentScope ? this.parentScope.getContext(key) : null;
  }
}

export function createRoot<T = any>(fn: (dispose: () => void) => T): T {
  const root = new Root();
  return root.execute(fn);
}

export function getCurrentScope(): Root | null {
  return scope;
}

export function createReactive<T>(
  initValue: (() => T) | T,
  effect = false,
  parentScope?: Root | null
) {
  if (parentScope !== undefined) {
    const prevScope = scope;
    try {
      scope = parentScope;
      return new ReactiveNode(initValue, effect);
    } finally {
      scope = prevScope;
    }
  }
  return new ReactiveNode(initValue, effect);
}

export function bindToScope<T = any>(fn: () => T, newScope: Root): () => T {
  return () => {
    const prevScope = scope;
    scope = newScope;
    try {
      return fn();
    } finally {
      scope = prevScope;
    }
  };
}

export function setContext(key: PropertyKey, value: any) {
  const currScope = getCurrentScope();
  currScope && currScope.setContext(key, value);
}

export function getContext<T>(key: PropertyKey): T | null {
  const currScope = getCurrentScope();
  return currScope ? currScope.getContext(key) : null;
}

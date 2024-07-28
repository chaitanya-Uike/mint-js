import { isFunction } from "./utils";

let currentObserver: Reactive | null = null;
let newSources: Set<Reactive> | null = null;
let effectsQueue: Reactive[] = [];
let effectsScheduled = false;
interface Disposable {
  dispose: () => void;
}
let children: Disposable[] | null = null;

enum CacheState {
  Clean,
  Check,
  Dirty,
  Disposed,
}

type CacheStale = CacheState.Check | CacheState.Dirty;

type ComputeFn<T> = (prevVal?: T) => T;
type Cleanup = () => void;

export class Reactive<T = any> implements Disposable {
  private _value: T;
  private compute?: ComputeFn<T>;
  private _state: CacheState;
  private effect: boolean;
  sources: Set<Reactive> | null = null;
  observers: Set<Reactive> | null = null;

  cleanups: Cleanup[] | null = null;

  constructor(initValue: (() => T) | T, effect = false) {
    this.compute = isFunction(initValue) ? initValue : undefined;
    this._state = this.compute ? CacheState.Dirty : CacheState.Clean;
    this._value = this.compute ? (undefined as any) : initValue;
    this.effect = effect;
    if (effect) scheduleEffect(this);
    if (children) children.push(this);
  }

  get(): T {
    if (this.state === CacheState.Disposed) return this._value;
    if (!newSources) newSources = new Set();
    newSources.add(this);
    if (this.compute) this.updateIfRequired();
    return this._value;
  }

  set(newVal: ComputeFn<T> | T) {
    const nextVal = isFunction(newVal) ? newVal(this._value) : newVal;
    if (nextVal !== this._value) {
      this._value = nextVal;
      this.notifyObservers(CacheState.Dirty);
    }
  }

  get state() {
    return this._state;
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
    const oldValue = this._value;
    try {
      this.handleCleanup();
      this._value = this.compute!();
      this.updateGraph();
    } finally {
      resumeTracking(context);
    }
    if (oldValue !== this._value && this.observers) {
      for (const observer of this.observers) {
        observer._state = CacheState.Dirty;
      }
    }
    this._state = CacheState.Clean;
  }

  private updateGraph(): void {
    const currentSources = this.sources || new Set<Reactive>();
    const updatedSources = newSources || new Set<Reactive>();

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
    console.log("disposing", this);
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
}

function suspendTracking(newObserver: Reactive | null = null) {
  const currContext = {
    currentObserver,
    newSources: newSources,
  };
  currentObserver = newObserver;
  newSources = null;
  return currContext;
}

function resumeTracking(context: {
  currentObserver: Reactive | null;
  newSources: Set<Reactive> | null;
}) {
  ({ currentObserver, newSources: newSources } = context);
}

export function flush() {
  for (let i = 0; i < effectsQueue.length; i++) {
    const effect = effectsQueue[i];
    if (effect.state !== CacheState.Clean) effectsQueue[i].get();
  }
  effectsScheduled = false;
}

function scheduleEffect(effect: Reactive<any>) {
  effectsQueue.push(effect);
  if (!effectsScheduled) {
    effectsScheduled = true;
    queueMicrotask(flush);
  }
}

export function effect(fn: () => any) {
  const node = new Reactive(fn, true);
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

interface Root extends Disposable {
  _children: Disposable[];
}

export function createRoot<T = any>(fn: (dispose: () => void) => T): T {
  const root: Root = {
    _children: [],
    dispose: function () {
      children && this._children.push(...children) && (children = null);
      for (let i = this._children.length - 1; i >= 0; i--) {
        const child = this._children[i];
        child !== this && child.dispose();
      }
      this._children.length = 0;
    },
  };
  (children ?? (children = [])).push(root);
  const prevChildren = children;
  children = [];
  try {
    return fn(root.dispose.bind(root));
  } finally {
    children && (root._children = [...children]);
    children = prevChildren;
  }
}

let currentObserver: Reactive<any> | null = null;
let newDeps: Reactive<any>[] | null = null;
let currentDepIndex = 0;

let effectsQueue: Reactive<any>[] = [];
let effectsScheduled = false;

let childNodes: Set<Reactive<any>> | null = null;

enum CacheState {
  Clean,
  Check,
  Dirty,
}

type CacheStale = CacheState.Check | CacheState.Dirty;

type ComputeFn<T> = (prevVal: T) => T;
type Cleanup = () => void;

export class Reactive<T> {
  private _value: T;
  private compute?: ComputeFn<T>;
  private _state: CacheState;
  private effect: boolean;
  private deps: Reactive<any>[] | null = null;
  private observers: Reactive<any>[] | null = null;
  private _disposed = false;

  cleanups: Cleanup[] = [];

  constructor(initValue: ComputeFn<T> | T, effect = false) {
    if (typeof initValue === "function") {
      this.compute = initValue as ComputeFn<T>;
      this._value = undefined as any;
      this._state = CacheState.Dirty;
      this.effect = effect;

      if (effect) {
        scheduleEffect(this);
      }
    } else {
      this._value = initValue as T;
      this._state = CacheState.Clean;
      this.effect = false;
    }
    if (childNodes) childNodes.add(this);
  }

  get(): T {
    if (this._disposed) {
      console.warn("trying to access disposed value");
      return this._value;
    }

    if (currentObserver) {
      if (
        !newDeps &&
        currentObserver.deps &&
        currentObserver.deps[currentDepIndex] === this
      ) {
        currentDepIndex++;
      } else {
        if (!newDeps) newDeps = [this];
        else newDeps.push(this);
      }
    }

    if (this.compute) this.updateIfRequired();

    return this._value;
  }

  set(newValue: ComputeFn<T> | T) {
    if (this._disposed) {
      console.warn("trying to set a disposed value");
      return;
    }

    console.log("Set called", newValue);

    if (typeof newValue === "function") {
      const fn = newValue as ComputeFn<T>;
      if (fn !== this.compute) {
        this._state = CacheState.Dirty;
      }
      this.compute = fn;
    } else {
      if (this.compute) {
        this.removeDepObserver(0);
        this.compute = undefined;
        this.deps = null;
      }
      const value = newValue as T;
      if (value !== this._value) {
        this._value = value;
        this.notifyObservers(CacheState.Dirty);
      }
    }
  }

  get state() {
    return this._state;
  }

  get disposed() {
    return this._disposed;
  }

  private updateIfRequired() {
    if (this._state === CacheState.Check && this.deps) {
      for (const dep of this.deps) {
        dep.updateIfRequired();
        if ((this._state as CacheState) === CacheState.Dirty) {
          break;
        }
      }
    }

    if (this._state === CacheState.Dirty) {
      this.update();
    }

    this._state = CacheState.Clean;
  }

  private update() {
    const context = suspendTracking(this);
    const oldValue = this._value;

    try {
      this.handleCleanup();
      this._value = this.compute!(this._value);
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

  private updateGraph() {
    // if new dependencies were discovered in current run
    if (newDeps) {
      this.removeDepObserver(currentDepIndex);
      if (this.deps && currentDepIndex > 0) {
        this.deps.length = currentDepIndex + newDeps.length;
        for (let i = 0; i < newDeps.length; i++) {
          this.deps[currentDepIndex + i] = newDeps[i];
        }
      } else {
        this.deps = newDeps;
      }

      // add current reactiveNode as an observer of the new deps
      for (let i = currentDepIndex; i < this.deps.length; i++) {
        const dep: Reactive<any> = this.deps[i];
        if (!dep.observers) dep.observers = [this];
        else dep.observers.push(this);
      }
    }
    // some old dependencies were not captured in the current run, remove them
    else if (this.deps && currentDepIndex < this.deps.length) {
      this.removeDepObserver(currentDepIndex);
      this.deps.length = currentDepIndex;
    }
  }

  private notifyObservers(state: CacheStale) {
    if (this.observers) {
      this.observers.forEach((observer) => observer.stale(state));
    }
  }

  handleCleanup() {
    if (this.cleanups.length) {
      this.cleanups.forEach((c) => c());
      this.cleanups = [];
    }
  }

  removeDepObserver(index: number) {
    if (this.deps) {
      for (let i = index; i < this.deps.length; i++) {
        const dep: Reactive<any> = this.deps[i];
        if (dep.observers) {
          const swap = dep.observers.findIndex((o) => o === this);
          dep.observers[swap] = dep.observers[dep.observers.length - 1];
          dep.observers.pop();
        }
      }
    }
  }

  private stale(newState: CacheStale) {
    if (
      this._state === CacheState.Clean ||
      (this._state === CacheState.Check && newState === CacheState.Dirty)
    ) {
      if (this._state === CacheState.Clean && this.effect) scheduleEffect(this);
      this._state = newState;
      this.notifyObservers(CacheState.Check);
    }
  }

  dispose() {
    this._value = undefined as any;
    this.compute = undefined;
    this._state = CacheState.Clean;
    this.removeDepObserver(0);
    this.deps = null;
    this.handleCleanup();
    this._disposed = true;
  }
}

function suspendTracking(newObserver: Reactive<any> | null = null) {
  const currContext = {
    currentObserver,
    newSources: newDeps,
    currentSourceIndex: currentDepIndex,
  };
  currentObserver = newObserver;
  newDeps = null;
  currentDepIndex = 0;
  return currContext;
}

function resumeTracking(context: {
  currentObserver: Reactive<any> | null;
  newSources: Reactive<any>[] | null;
  currentSourceIndex: number;
}) {
  ({
    currentObserver,
    newSources: newDeps,
    currentSourceIndex: currentDepIndex,
  } = context);
}

function scheduleEffect(effect: Reactive<any>) {
  effectsQueue.push(effect);
  if (!effectsScheduled) {
    effectsScheduled = true;
    queueMicrotask(() => {
      for (let i = 0; i < effectsQueue.length; i++) {
        const effect = effectsQueue[i];
        if (effect.state !== CacheState.Clean && !effect.disposed)
          effectsQueue[i].get();
      }
      effectsScheduled = false;
    });
  }
}

export function effect(fn: () => any) {
  new Reactive(fn, true);
}

export function onCleanup(fn: Cleanup) {
  if (currentObserver) {
    currentObserver.cleanups.push(fn);
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

export function createRoot<T = any>(fn: () => T): [T, () => void] {
  const prevChildNodes = childNodes;
  childNodes = new Set();
  try {
    const val = fn();
    const capturedChildNodes = [...childNodes];
    const dispose = () => {
      for (const node of capturedChildNodes) {
        node.dispose();
      }
    };
    return [val, dispose] as const;
  } finally {
    childNodes = prevChildNodes;
  }
}

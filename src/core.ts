let currentObserver: Reactive<any> | null = null;
let newSources: Reactive<any>[] | null = null;
let currentSourceIndex = 0;
let effectsQueue: Reactive<any>[] = [];
let effectsScheduled = false;
let children: Reactive<any>[] | null = null;

enum CacheState {
  Clean,
  Check,
  Dirty,
  Disposed,
}

type CacheStale = CacheState.Check | CacheState.Dirty;

type ComputeFn<T> = (prevVal?: T) => T;
type Cleanup = () => void;

const isFunc = (val: any): val is Function => typeof val === "function";

export class Reactive<T> {
  private _value: T;
  private compute?: ComputeFn<T>;
  private _state: CacheState;
  private effect: boolean;
  sources: Reactive<any>[] | null = null;
  observers: Reactive<any>[] | null = null;

  cleanups: Cleanup[] | null = null;

  constructor(initValue: (() => T) | T, effect = false) {
    if (typeof initValue === "function") {
      this.compute = initValue as ComputeFn<T>;
      this._value = undefined as any;
      this._state = CacheState.Dirty;
      this.effect = effect;

      if (effect) {
        scheduleEffect(this);
        flush();
      }
    } else {
      this._value = initValue as T;
      this._state = CacheState.Clean;
      this.effect = false;
    }
    if (children) children.push(this);
  }

  get(): T {
    if (this.state === CacheState.Disposed) return this._value;
    if (currentObserver) {
      if (
        !newSources &&
        currentObserver.sources &&
        currentObserver.sources[currentSourceIndex] === this
      ) {
        currentSourceIndex++;
      } else {
        if (!newSources) newSources = [this];
        else newSources.push(this);
      }
    }
    if (this.compute) this.updateIfRequired();
    return this._value;
  }

  set(newVal: ComputeFn<T> | T) {
    const nextVal = isFunc(newVal) ? newVal(this._value) : newVal;
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

  private updateGraph() {
    // if new dependencies were discovered in current run
    if (newSources) {
      this.removeSourceObserver(currentSourceIndex);
      if (this.sources && currentSourceIndex > 0) {
        this.sources.length = currentSourceIndex + newSources.length;
        for (let i = 0; i < newSources.length; i++) {
          this.sources[currentSourceIndex + i] = newSources[i];
        }
      } else {
        this.sources = newSources;
      }

      // add current reactiveNode as an observer of the new deps
      for (let i = currentSourceIndex; i < this.sources.length; i++) {
        const source: Reactive<any> = this.sources[i];
        if (!source.observers) source.observers = [this];
        else source.observers.push(this);
      }
    }
    // some old dependencies were not captured in the current run, remove them
    else if (this.sources && currentSourceIndex < this.sources.length) {
      this.removeSourceObserver(currentSourceIndex);
      this.sources.length = currentSourceIndex;
    }
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

  removeSourceObserver(index: number) {
    if (this.sources) {
      for (let i = index; i < this.sources.length; i++) {
        const source: Reactive<any> = this.sources[i];
        if (source.observers) {
          const swap = source.observers.findIndex((o) => o === this);
          source.observers[swap] =
            source.observers[source.observers.length - 1];
          source.observers.pop();
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
    this._state = CacheState.Disposed;
    this.handleCleanup();
    if (this.sources) this.removeSourceObserver(0);
    this.sources = null;
    this.observers = null;
  }
}

function suspendTracking(newObserver: Reactive<any> | null = null) {
  const currContext = {
    currentObserver,
    newSources: newSources,
    currentSourceIndex: currentSourceIndex,
  };
  currentObserver = newObserver;
  newSources = null;
  currentSourceIndex = 0;
  return currContext;
}

function resumeTracking(context: {
  currentObserver: Reactive<any> | null;
  newSources: Reactive<any>[] | null;
  currentSourceIndex: number;
}) {
  ({
    currentObserver,
    newSources: newSources,
    currentSourceIndex: currentSourceIndex,
  } = context);
}

function flush() {
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
  new Reactive(fn, true);
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

export function createRoot<T = any>(fn: (dispose: () => void) => T): T {
  const prevChildNodes = children;
  children = [];
  const dispose = () => {
    if (!children) return;
    for (let i = children.length - 1; i >= 0; i--) {
      children[i].dispose();
    }
    children = null;
  };
  const result = fn(dispose);
  children = prevChildNodes;
  return result;
}

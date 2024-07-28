import { isFunction } from "./utils";
let currentObserver = null;
let newSources = null;
let effectsQueue = [];
let effectsScheduled = false;
let scope = null;
var CacheState;
(function (CacheState) {
    CacheState[CacheState["Clean"] = 0] = "Clean";
    CacheState[CacheState["Check"] = 1] = "Check";
    CacheState[CacheState["Dirty"] = 2] = "Dirty";
    CacheState[CacheState["Disposed"] = 3] = "Disposed";
})(CacheState || (CacheState = {}));
export class Reactive {
    _value;
    compute;
    _state;
    effect;
    _scope = null;
    sources = null;
    observers = null;
    cleanups = null;
    constructor(initValue, effect = false) {
        this.compute = isFunction(initValue) ? initValue : undefined;
        this._state = this.compute ? CacheState.Dirty : CacheState.Clean;
        this._value = this.compute ? undefined : initValue;
        this.effect = effect;
        if (effect)
            scheduleEffect(this);
        if (scope) {
            this._scope = scope;
            this._scope.append(this);
        }
    }
    get() {
        if (this.state === CacheState.Disposed)
            return this._value;
        if (!newSources)
            newSources = new Set();
        newSources.add(this);
        if (this.compute)
            this.updateIfRequired();
        return this._value;
    }
    set(newVal) {
        const nextVal = isFunction(newVal) ? newVal(this._value) : newVal;
        if (nextVal !== this._value) {
            this._value = nextVal;
            this.notifyObservers(CacheState.Dirty);
        }
    }
    get state() {
        return this._state;
    }
    updateIfRequired() {
        if (this._state === CacheState.Check && this.sources) {
            for (const source of this.sources) {
                source.updateIfRequired();
                if (this._state === CacheState.Dirty) {
                    break;
                }
            }
        }
        if (this._state === CacheState.Dirty)
            this.update();
        this._state = CacheState.Clean;
    }
    update() {
        const context = suspendTracking(this);
        const oldValue = this._value;
        try {
            this.handleCleanup();
            this._value = this.compute();
            this.updateGraph();
        }
        finally {
            resumeTracking(context);
        }
        if (oldValue !== this._value && this.observers) {
            for (const observer of this.observers) {
                observer._state = CacheState.Dirty;
            }
        }
        this._state = CacheState.Clean;
    }
    updateGraph() {
        const currentSources = this.sources || new Set();
        const updatedSources = newSources || new Set();
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
    notifyObservers(state) {
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
    stale(newState) {
        if (this._state === CacheState.Clean ||
            (this._state === CacheState.Check && newState === CacheState.Dirty)) {
            if (this._state === CacheState.Clean && this.effect) {
                scheduleEffect(this);
            }
            this._state = newState;
            this.notifyObservers(CacheState.Check);
        }
    }
    dispose() {
        if (this._state === CacheState.Disposed)
            return;
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
    updateScope(newScope) {
        this._scope?.removeChild(this);
        this._scope = newScope;
        this._scope?.append(this);
    }
}
function suspendTracking(newObserver = null) {
    const currContext = {
        currentObserver,
        newSources: newSources,
    };
    currentObserver = newObserver;
    newSources = null;
    return currContext;
}
function resumeTracking(context) {
    ({ currentObserver, newSources: newSources } = context);
}
export function flush() {
    for (let i = 0; i < effectsQueue.length; i++) {
        const effect = effectsQueue[i];
        if (effect.state !== CacheState.Clean)
            effectsQueue[i].get();
    }
    effectsScheduled = false;
}
function scheduleEffect(effect) {
    effectsQueue.push(effect);
    if (!effectsScheduled) {
        effectsScheduled = true;
        queueMicrotask(flush);
    }
}
export function effect(fn) {
    const node = createReactive(fn, true);
    node.get();
}
// should only be called inside an effect
export function onCleanup(fn) {
    if (currentObserver) {
        if (!currentObserver.cleanups)
            currentObserver.cleanups = [fn];
        else
            currentObserver.cleanups.push(fn);
    }
}
export function unTrack(fn) {
    const context = suspendTracking();
    try {
        return fn();
    }
    finally {
        resumeTracking(context);
    }
}
export class Root {
    children;
    parentScope;
    disposed = false;
    fn;
    constructor(fn) {
        this.fn = fn;
        this.children = new Set();
        this.parentScope = scope;
        this.parentScope?.append(this);
    }
    append(child) {
        if (!this.disposed)
            this.children.add(child);
    }
    dispose() {
        if (this.disposed)
            return;
        for (const child of this.children)
            child.dispose();
        this.children.clear();
        this.parentScope?.children.delete(this);
        this.disposed = true;
    }
    execute() {
        scope = this;
        try {
            return this.fn(this.dispose.bind(this));
        }
        finally {
            scope = this.parentScope;
        }
    }
    removeChild(child) {
        return this.children.delete(this);
    }
}
export function createRoot(fn) {
    const root = new Root(fn);
    return root.execute();
}
export function getCurrentScope() {
    return scope;
}
export function createReactive(initValue, effect = false, parentScope = null) {
    const prevScope = scope;
    scope = parentScope;
    const reactive = new Reactive(initValue, effect);
    scope = prevScope;
    return reactive;
}

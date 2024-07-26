let currentObserver = null;
let newSources = null;
let effectsQueue = [];
let effectsScheduled = false;
let children = null;
var CacheState;
(function (CacheState) {
    CacheState[CacheState["Clean"] = 0] = "Clean";
    CacheState[CacheState["Check"] = 1] = "Check";
    CacheState[CacheState["Dirty"] = 2] = "Dirty";
    CacheState[CacheState["Disposed"] = 3] = "Disposed";
})(CacheState || (CacheState = {}));
const isFunc = (val) => typeof val === "function";
export class Reactive {
    _value;
    compute;
    _state;
    effect;
    sources = null;
    observers = null;
    cleanups = null;
    constructor(initValue, effect = false) {
        this.compute = isFunc(initValue) ? initValue : undefined;
        this._state = this.compute ? CacheState.Dirty : CacheState.Clean;
        this._value = this.compute ? undefined : initValue;
        this.effect = effect;
        if (effect)
            scheduleEffect(this);
        if (children)
            children.push(this);
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
        const nextVal = isFunc(newVal) ? newVal(this._value) : newVal;
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
        newSources = null;
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
function flush() {
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
    const node = new Reactive(fn, true);
    node.get(); // Execute immediately
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
export function createRoot(fn) {
    const prevChildNodes = children;
    children = [];
    const dispose = () => {
        if (!children)
            return;
        for (let i = children.length - 1; i >= 0; i--) {
            children[i].dispose();
        }
        children = null;
    };
    const result = fn(dispose);
    children = prevChildNodes;
    return result;
}

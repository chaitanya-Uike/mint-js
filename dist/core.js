let currentObserver = null;
let newDeps = null;
let currentDepIndex = 0;
let effectsQueue = [];
let effectsScheduled = false;
let childNodes = null;
var CacheState;
(function (CacheState) {
    CacheState[CacheState["Clean"] = 0] = "Clean";
    CacheState[CacheState["Check"] = 1] = "Check";
    CacheState[CacheState["Dirty"] = 2] = "Dirty";
})(CacheState || (CacheState = {}));
export class Reactive {
    _value;
    compute;
    _state;
    effect;
    deps = null;
    observers = null;
    _disposed = false;
    cleanups = [];
    constructor(initValue, effect = false) {
        if (typeof initValue === "function") {
            this.compute = initValue;
            this._value = undefined;
            this._state = CacheState.Dirty;
            this.effect = effect;
            if (effect) {
                scheduleEffect(this);
            }
        }
        else {
            this._value = initValue;
            this._state = CacheState.Clean;
            this.effect = false;
        }
        if (childNodes)
            childNodes.add(this);
    }
    get() {
        if (this._disposed) {
            console.warn("trying to access disposed value");
            return this._value;
        }
        if (currentObserver) {
            if (!newDeps &&
                currentObserver.deps &&
                currentObserver.deps[currentDepIndex] === this) {
                currentDepIndex++;
            }
            else {
                if (!newDeps)
                    newDeps = [this];
                else
                    newDeps.push(this);
            }
        }
        if (this.compute)
            this.updateIfRequired();
        return this._value;
    }
    set(newValue) {
        if (this._disposed) {
            console.warn("trying to set a disposed value");
            return;
        }
        if (typeof newValue === "function") {
            const fn = newValue;
            if (fn !== this.compute) {
                this._state = CacheState.Dirty;
            }
            this.compute = fn;
        }
        else {
            if (this.compute) {
                this.removeDepObserver(0);
                this.compute = undefined;
                this.deps = null;
            }
            const value = newValue;
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
    updateIfRequired() {
        if (this._state === CacheState.Check && this.deps) {
            for (const dep of this.deps) {
                dep.updateIfRequired();
                if (this._state === CacheState.Dirty) {
                    break;
                }
            }
        }
        if (this._state === CacheState.Dirty) {
            this.update();
        }
        this._state = CacheState.Clean;
    }
    update() {
        const context = suspendTracking(this);
        const oldValue = this._value;
        try {
            this.handleCleanup();
            this._value = this.compute(this._value);
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
        // if new dependencies were discovered in current run
        if (newDeps) {
            this.removeDepObserver(currentDepIndex);
            if (this.deps && currentDepIndex > 0) {
                this.deps.length = currentDepIndex + newDeps.length;
                for (let i = 0; i < newDeps.length; i++) {
                    this.deps[currentDepIndex + i] = newDeps[i];
                }
            }
            else {
                this.deps = newDeps;
            }
            // add current reactiveNode as an observer of the new deps
            for (let i = currentDepIndex; i < this.deps.length; i++) {
                const dep = this.deps[i];
                if (!dep.observers)
                    dep.observers = [this];
                else
                    dep.observers.push(this);
            }
        }
        // some old dependencies were not captured in the current run, remove them
        else if (this.deps && currentDepIndex < this.deps.length) {
            this.removeDepObserver(currentDepIndex);
            this.deps.length = currentDepIndex;
        }
    }
    notifyObservers(state) {
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
    removeDepObserver(index) {
        if (this.deps) {
            for (let i = index; i < this.deps.length; i++) {
                const dep = this.deps[i];
                if (dep.observers) {
                    const swap = dep.observers.findIndex((o) => o === this);
                    dep.observers[swap] = dep.observers[dep.observers.length - 1];
                    dep.observers.pop();
                }
            }
        }
    }
    stale(newState) {
        if (this._state === CacheState.Clean ||
            (this._state === CacheState.Check && newState === CacheState.Dirty)) {
            if (this._state === CacheState.Clean && this.effect)
                scheduleEffect(this);
            this._state = newState;
            this.notifyObservers(CacheState.Check);
        }
    }
    dispose() {
        this._value = undefined;
        this.compute = undefined;
        this._state = CacheState.Clean;
        this.removeDepObserver(0);
        this.deps = null;
        this.handleCleanup();
    }
}
function suspendTracking(newObserver = null) {
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
function resumeTracking(context) {
    ({
        currentObserver,
        newSources: newDeps,
        currentSourceIndex: currentDepIndex,
    } = context);
}
function scheduleEffect(effect) {
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
export function effect(fn) {
    new Reactive(fn, true);
}
export function onCleanup(fn) {
    if (currentObserver) {
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
        return [val, dispose];
    }
    finally {
        childNodes = prevChildNodes;
    }
}

import { isFunction } from "./utils";
let currentScope = null;
let currentObserver = null;
let newSources = null;
let effectsQueue = [];
let effectsScheduled = false;
let runningEffects = false;
var CacheState;
(function (CacheState) {
    CacheState[CacheState["Clean"] = 0] = "Clean";
    CacheState[CacheState["Check"] = 1] = "Check";
    CacheState[CacheState["Dirty"] = 2] = "Dirty";
})(CacheState || (CacheState = {}));
export class Disposable {
    _scope;
    _disposed;
    constructor() {
        this._scope = currentScope;
        currentScope?.append(this);
        this._disposed = false;
    }
    dispose() {
        this._scope?.remove(this);
        this._disposed = true;
    }
    updateScope(newScope) {
        if (newScope === this._scope)
            return;
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
    children;
    constructor() {
        super();
        this.children = new Set();
    }
    dispose() {
        if (this.disposed)
            return;
        for (const child of this.children)
            child.dispose();
        this.children.clear();
        super.dispose();
    }
    append(child) {
        if (!this.disposed)
            this.children.add(child);
    }
    remove(child) {
        this.children.delete(child);
    }
}
export class ReactiveNode extends ScopeNode {
    value;
    compute;
    _state;
    _effect;
    sources = null;
    observers = null;
    cleanups = [];
    label;
    constructor(initValue, effect = false, label) {
        super();
        this.compute = isFunction(initValue) ? initValue : undefined;
        this._state = this.compute ? CacheState.Dirty : CacheState.Clean;
        this.value = this.compute ? undefined : initValue;
        this._effect = effect;
        this.label = label;
    }
    get state() {
        return this._state;
    }
    get effect() {
        return this._effect;
    }
    get() {
        if (this.disposed)
            return this.value;
        if (currentObserver && !this.effect) {
            if (!newSources)
                newSources = new Set();
            newSources.add(this);
        }
        if (this.compute)
            this.updateIfRequired();
        return this.value;
    }
    set(newValue) {
        if (isFunction(newValue)) {
            if (newValue !== this.compute)
                this.stale(CacheState.Dirty);
            this.compute = newValue;
        }
        else {
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
        const oldValue = this.value;
        this.handleCleanup();
        const fn = () => {
            const newValue = this.compute(oldValue);
            this.updateGraph();
            return newValue;
        };
        this.value = execute(fn, this, this);
        if (oldValue !== this.value && this.observers) {
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
    stale(newState) {
        if (this._state === CacheState.Clean ||
            (this._state === CacheState.Check && newState === CacheState.Dirty)) {
            if (this._effect) {
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
        if (this.disposed)
            return;
        super.dispose();
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
function execute(fn, observer, scope) {
    const prevObserver = currentObserver;
    const prevScope = currentScope;
    const prevSources = newSources;
    currentObserver = observer;
    currentScope = scope;
    newSources = null;
    try {
        return fn();
    }
    finally {
        currentObserver = prevObserver;
        currentScope = prevScope;
        newSources = prevSources;
    }
}
export function effect(fn, label) {
    const computeFn = () => {
        const cleanup = fn();
        isFunction(cleanup) && onCleanup(cleanup);
    };
    const effectNode = createReactive(computeFn, true, undefined, label);
    onCleanup(effectNode.dispose.bind(effectNode));
    effectNode.get();
}
export function createReactive(initValue, effect = false, scope, label) {
    const executionScope = scope !== undefined ? scope : currentScope;
    return execute(() => new ReactiveNode(initValue, effect, label), currentObserver, executionScope);
}
export function unTrack(fn) {
    return execute(fn, null, currentScope);
}
export function createRoot(fn) {
    const scope = new ScopeNode();
    return execute(() => fn(scope.dispose.bind(scope)), currentObserver, scope);
}
export function onCleanup(fn) {
    if (currentObserver)
        currentObserver.cleanups.push(fn);
}
export function getCurrentScope() {
    return currentScope;
}
export function flush() {
    if (!runningEffects)
        runEffects();
}
function runEffects() {
    runningEffects = true;
    for (const effect of effectsQueue) {
        if (!effect.disposed && effect.state !== CacheState.Clean) {
            runTopDown(effect);
        }
    }
    effectsQueue = [];
    runningEffects = false;
}
function runTopDown(node) {
    const ancestors = [node];
    while (node && (node = node.scope)) {
        if (node instanceof ReactiveNode &&
            node.effect &&
            node.state !== CacheState.Clean)
            ancestors.push(node);
    }
    for (let i = ancestors.length - 1; i >= 0; i--) {
        ancestors[i].get();
    }
}
function scheduleEffect(effect) {
    effectsQueue.push(effect);
    if (!effectsScheduled) {
        effectsScheduled = true;
        queueMicrotask(() => {
            effectsScheduled = false;
            runEffects();
        });
    }
}

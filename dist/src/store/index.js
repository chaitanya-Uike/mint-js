import { ScopeNode } from "../core";
import { NODE } from "../constants";
import { isSignal, signal } from "../signals";
const STORE = Symbol("store");
class StoreNode extends ScopeNode {
    objectCache;
    arrayCache;
    constructor() {
        super();
        this.objectCache = new Map();
        this.arrayCache = [];
    }
    get(key) {
        return isArrayIndex(key)
            ? this.arrayCache[Number(key)]
            : this.objectCache.get(key);
    }
    set(key, value) {
        this.get(key)?.[NODE].dispose();
        value[NODE].updateScope(this);
        if (isArrayIndex(key))
            this.arrayCache[Number(key)] = value;
        else
            this.objectCache.set(key, value);
        return this;
    }
    has(key) {
        return this.objectCache.has(key) || key in this.arrayCache;
    }
    delete(key) {
        if (!this.has(key))
            return false;
        this.get(key)[NODE].dispose();
        if (isArrayIndex(key) && key in this.arrayCache)
            this.arrayCache.splice(Number(key), 1);
        else
            this.objectCache.delete(key);
        return true;
    }
    updateScope(newScope) {
        if (this.scope === newScope)
            return;
        for (const [, entry] of this.objectCache)
            entry[NODE].updateScope(newScope);
        for (const entry of this.arrayCache)
            entry[NODE].updateScope(newScope);
        super.updateScope(newScope);
    }
    dispose() {
        for (const [, entry] of this.objectCache)
            entry[NODE].dispose();
        for (const entry of this.arrayCache)
            entry[NODE].dispose();
        this.objectCache.clear();
        this.arrayCache.length = 0;
        super.dispose();
    }
}
function isArrayIndex(key) {
    if (typeof key === "symbol")
        return false;
    const num = Number(key);
    return Number.isInteger(num) && num >= 0 && num < 2 ** 32 - 1;
}
function createReactive(value) {
    if (isSignal(value) || isStore(value))
        return value;
    return isWrappable(value) ? store(value) : signal(value);
}
const createStoreProxy = (initValue) => {
    const proxyHandler = {
        get(target, key, receiver) {
            const value = Reflect.get(target, key, receiver);
            if (key === STORE || key === NODE)
                return value;
            if (isTrackable(target, key, receiver)) {
                const storeNode = target[NODE];
                if (!storeNode.has(key)) {
                    storeNode.set(key, createReactive(value));
                }
                const reactive = storeNode.get(key);
                return isSignal(reactive) ? reactive() : reactive;
            }
            return value;
        },
        set(target, key, newValue, receiver) {
            const result = Reflect.set(target, key, newValue, receiver);
            if (key === STORE || key === NODE)
                return result;
            if (isTrackable(target, key, receiver)) {
                updateStoreNode(target[NODE], key, newValue);
            }
            return result;
        },
        deleteProperty(target, key) {
            target[NODE].delete(key);
            return Reflect.deleteProperty(target, key);
        },
        has(target, prop) {
            return Reflect.has(target, prop);
        },
    };
    return new Proxy(initValue, proxyHandler);
};
export function store(initValue) {
    const value = initValue;
    value[STORE] = true;
    value[NODE] = new StoreNode();
    const proxy = createStoreProxy(value);
    const keys = Object.keys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const prop of keys) {
        if (descriptors[prop]?.get) {
            descriptors[prop].get = descriptors[prop].get.bind(proxy);
        }
    }
    return proxy;
}
export function isStore(value) {
    return (typeof value === "object" &&
        value !== null &&
        STORE in value &&
        NODE in value);
}
function isWrappable(obj) {
    return (obj != null &&
        typeof obj === "object" &&
        (Object.getPrototypeOf(obj) === Object.prototype || Array.isArray(obj)));
}
function isTrackable(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    const descriptor = Object.getOwnPropertyDescriptor(target, prop);
    return (isSignal(value) ||
        isStore(value) ||
        (typeof value !== "function" &&
            Object.prototype.hasOwnProperty.call(target, prop) &&
            !(descriptor && descriptor.get)));
}
function handleExistingSignal(storeNode, key, newValue) {
    if (isSignal(newValue) || isStore(newValue) || isWrappable(newValue)) {
        storeNode.set(key, createReactive(newValue));
    }
    else {
        const existing = storeNode.get(key);
        existing.set(newValue);
    }
}
function mergeStore(existing, newValue) {
    const existingKeys = new Set(Object.keys(existing));
    Object.entries(newValue).forEach(([subKey, subValue]) => {
        existing[subKey] = subValue;
        existingKeys.delete(subKey);
    });
    existingKeys.forEach((subKey) => {
        delete existing[subKey];
    });
}
function updateStoreNode(storeNode, key, newValue) {
    if (!storeNode.has(key)) {
        storeNode.set(key, createReactive(newValue));
    }
    else {
        const existing = storeNode.get(key);
        if (isSignal(existing)) {
            handleExistingSignal(storeNode, key, newValue);
        }
        else {
            if (isSignal(newValue)) {
                storeNode.set(key, newValue);
            }
            else if (isStore(newValue) || isWrappable(newValue)) {
                mergeStore(existing, newValue);
            }
            else {
                storeNode.set(key, createReactive(newValue));
            }
        }
    }
}

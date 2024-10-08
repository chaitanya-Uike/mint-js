import { DISPOSE, NODE } from "../constants";
import { createRoot, getCurrentScope } from "../core";
import { createSignalWithinScope, isSignal } from "../signals";
import { getSignalCache } from "./cache";
const CACHE = Symbol("signal-cache");
const SCOPE = Symbol("store-scope");
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
function updateStoreScope(store, scope) {
    if (store[SCOPE] === scope)
        return;
    for (const [, value] of store[CACHE]) {
        if (isSignal(value))
            value[NODE].updateScope(scope);
        else if (isStore(value))
            updateStoreScope(value, scope);
    }
    store[SCOPE] = scope;
}
export function isStore(value) {
    return (typeof value === "object" &&
        value !== null &&
        SCOPE in value &&
        CACHE in value);
}
function createReactive(target, value) {
    const scope = target[SCOPE];
    if (isSignal(value)) {
        value[NODE].updateScope(scope);
        return value;
    }
    if (isStore(value)) {
        updateStoreScope(value, scope);
        return value;
    }
    return isWrappable(value)
        ? store(value)
        : createSignalWithinScope(value, scope);
}
function getReactive(target, prop, value) {
    if (target[CACHE].has(prop))
        return target[CACHE].get(prop);
    return target[CACHE].set(prop, createReactive(target, value));
}
const proxyHandler = {
    get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (isTrackable(target, prop, receiver)) {
            const reactive = getReactive(target, prop, value);
            return isSignal(reactive) ? reactive() : reactive;
        }
        return value;
    },
    set(target, prop, newValue, receiver) {
        const result = Reflect.set(target, prop, newValue, receiver);
        if (isTrackable(target, prop, receiver)) {
            const existing = target[CACHE].get(prop);
            const merged = mergeValue(target, existing, newValue);
            target[CACHE].set(prop, merged);
        }
        return result;
    },
    deleteProperty(target, prop) {
        target[CACHE].delete(prop);
        return Reflect.deleteProperty(target, prop);
    },
    has(target, prop) {
        if (prop === SCOPE || prop === CACHE || prop === DISPOSE)
            return true;
        return Reflect.has(target, prop);
    },
};
function mergeValue(target, existing, newValue) {
    if (isSignal(existing)) {
        if (isSignal(newValue) || isStore(newValue) || isWrappable(newValue))
            return createReactive(target, newValue);
        existing.set(newValue);
        return existing;
    }
    else if (isStore(existing)) {
        if (!isStore(newValue) && isWrappable(newValue)) {
            const existingKeys = new Set(Object.keys(existing));
            Object.entries(newValue).forEach(([subKey, subValue]) => {
                existing[subKey] = subValue;
                existingKeys.delete(subKey);
            });
            existingKeys.forEach((subKey) => {
                delete existing[subKey];
            });
            return existing;
        }
        return createReactive(target, newValue);
    }
    return createReactive(target, newValue);
}
function wrap(value) {
    const proxy = new Proxy(value, proxyHandler);
    const keys = Object.keys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const prop of keys) {
        if (descriptors[prop]?.get) {
            descriptors[prop].get = descriptors[prop].get.bind(proxy);
        }
    }
    return proxy;
}
export function store(initValue) {
    if (!isWrappable(initValue)) {
        throw new TypeError("Initial value must be a object or array");
    }
    return createRoot((dispose) => {
        const store = initValue;
        const scope = getCurrentScope();
        const cache = getSignalCache(initValue);
        store[SCOPE] = scope;
        store[CACHE] = cache;
        scope.append({ dispose: cache.clear.bind(cache) });
        store[DISPOSE] = dispose;
        return wrap(store);
    });
}

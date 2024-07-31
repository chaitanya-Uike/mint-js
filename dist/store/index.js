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
    return (typeof value !== "function" &&
        Object.prototype.hasOwnProperty.call(target, prop) &&
        !(descriptor && descriptor.get));
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
        ? createStore(value)
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
            const reactive = getReactive(target, prop, undefined);
            const merged = mergeValue(target, reactive, newValue);
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
function mergeValue(target, reactive, newValue) {
    if (isSignal(reactive)) {
        if (isSignal(newValue) || isStore(newValue) || isWrappable(newValue))
            return createReactive(target, newValue);
        reactive.set(newValue);
        return reactive;
    }
    else if (isStore(reactive)) {
        if (!isStore(newValue) && isWrappable(newValue)) {
            const existingKeys = new Set(Object.keys(reactive));
            Object.entries(newValue).forEach(([subKey, subValue]) => {
                reactive[subKey] = subValue;
                existingKeys.delete(subKey);
            });
            existingKeys.forEach((subKey) => {
                delete reactive[subKey];
            });
            return reactive;
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
export function createStore(initValue) {
    if (!isWrappable(initValue)) {
        throw new Error("Initial value must be an object");
    }
    return createRoot((dispose) => {
        const store = initValue;
        store[SCOPE] = getCurrentScope();
        store[CACHE] = getSignalCache(initValue);
        store[DISPOSE] = dispose;
        return wrap(store);
    });
}

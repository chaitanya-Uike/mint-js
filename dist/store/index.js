import { DISPOSE, NODE } from "../constants";
import { createRoot, getCurrentScope } from "../core";
import { createSignalWithinScope, isSignal } from "../signals";
import { getSignalCache } from "./cache";
const STORE = Symbol("store");
const SCOPE = Symbol("scope");
export function isStore(value) {
    return typeof value === "object" && value !== null && STORE in value;
}
function updateStoreScope(store, scope) {
    if (store[SCOPE] === scope)
        return;
    for (const value of store[STORE]) {
        if (isSignal(value))
            value[NODE].updateScope(scope);
        else
            updateStoreScope(value, scope);
    }
    store[SCOPE] = scope;
}
function createReactive(value, scope) {
    if (isSignal(value)) {
        value[NODE].updateScope(scope);
        return value;
    }
    if (isStore(value)) {
        updateStoreScope(value, scope);
        return value;
    }
    return typeof value === "object" && value !== null
        ? createStore(value)
        : createSignalWithinScope(value, scope);
}
export function createStore(initialState) {
    return createRoot((dispose) => {
        const scope = getCurrentScope();
        const cache = getSignalCache(initialState);
        const handleNewValue = (key, newValue) => {
            const newReactive = createReactive(newValue, scope);
            cache.set(key, newReactive, newReactive[DISPOSE].bind(newReactive));
        };
        const store = new Proxy(initialState, {
            get(target, key) {
                if (key === STORE)
                    return cache;
                if (key === DISPOSE)
                    return dispose;
                if (key === SCOPE)
                    return scope;
                if (typeof key === "symbol")
                    return Reflect.get(target, key);
                if (Object.prototype.hasOwnProperty.call(target, key)) {
                    if (!cache.has(key))
                        handleNewValue(key, target[key]);
                    const cachedValue = cache.get(key);
                    return isSignal(cachedValue) ? cachedValue() : cachedValue;
                }
                return Reflect.get(target, key);
            },
            set(target, key, newValue) {
                if (key === STORE || key === SCOPE || key === DISPOSE)
                    true;
                if (typeof key === "symbol")
                    return Reflect.set(target, key, newValue);
                const result = Reflect.set(target, key, newValue);
                if (Object.prototype.hasOwnProperty.call(target, key)) {
                    const existingValue = cache.get(key);
                    if (isSignal(existingValue)) {
                        if (isSignal(newValue) || isStore(newValue) || (typeof newValue === "object" && newValue !== null)) {
                            handleNewValue(key, newValue);
                        }
                        else {
                            existingValue.set(newValue);
                        }
                    }
                    else if (isStore(existingValue)) {
                        if (!isStore(newValue) && typeof newValue === "object" && newValue !== null) {
                            const existingKeys = new Set(Object.keys(existingValue));
                            Object.entries(newValue).forEach(([subKey, subValue]) => {
                                existingValue[subKey] = subValue;
                                existingKeys.delete(subKey);
                            });
                            existingKeys.forEach((subKey) => {
                                delete existingValue[subKey];
                            });
                        }
                        else {
                            handleNewValue(key, newValue);
                        }
                    }
                    else {
                        handleNewValue(key, newValue);
                    }
                }
                // delete trap is not triggered when length is set manually
                if (Array.isArray(target) && key === "length") {
                    for (let i = newValue; i < cache.size(); i++) {
                        cache.delete(i);
                    }
                }
                return result;
            },
            deleteProperty(target, key) {
                if (key === STORE || key === SCOPE || key === DISPOSE)
                    return true;
                if (typeof key === "symbol")
                    return Reflect.deleteProperty(target, key);
                if (Object.prototype.hasOwnProperty.call(target, key)) {
                    cache.delete(key);
                    return Reflect.deleteProperty(target, key);
                }
                return true;
            },
        });
        store[STORE] = cache;
        store[DISPOSE] = dispose;
        store[SCOPE] = scope;
        return store;
    });
}

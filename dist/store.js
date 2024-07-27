import { signal } from "./signals";
const STORE = Symbol("store");
const RAW = Symbol("raw");
function isSignal(value) {
    return typeof value === "function" && "set" in value;
}
function isStore(value) {
    return typeof value === "object" && value !== null && STORE in value;
}
export function createStore(initialState) {
    const signalCache = new Map();
    const store = new Proxy(initialState, {
        get(target, key) {
            if (key === RAW)
                return target;
            if (key === STORE)
                return signalCache;
            if (typeof key === "symbol")
                return Reflect.get(target, key);
            if (Object.prototype.hasOwnProperty.call(target, key)) {
                if (!signalCache.has(key)) {
                    const value = target[key];
                    signalCache.set(key, typeof value === "object" && value !== null
                        ? createStore(value)
                        : signal(value));
                }
                const cachedValue = signalCache.get(key);
                return isSignal(cachedValue) ? cachedValue() : cachedValue;
            }
            return Reflect.get(target, key);
        },
        set(target, key, newValue) {
            if (typeof key === "symbol")
                return Reflect.set(target, key, newValue);
            if (Object.prototype.hasOwnProperty.call(target, key)) {
                const existingValue = signalCache.get(key);
                if (isSignal(existingValue)) {
                    if (typeof newValue === "object" && newValue !== null) {
                        // Case: cached value is a signal, new value is an object
                        const newStore = createStore(newValue);
                        signalCache.set(key, newStore);
                    }
                    else {
                        // Case: cached value is a signal, new value is a primitive
                        existingValue.set(newValue);
                    }
                }
                else if (isStore(existingValue)) {
                    if (typeof newValue === "object" && newValue !== null) {
                        // Case: cached value is a store, new value is an object
                        Object.keys(existingValue).forEach((subKey) => {
                            if (subKey in newValue) {
                                existingValue[subKey] = newValue[subKey];
                            }
                        });
                        Object.keys(newValue).forEach((subKey) => {
                            if (!(subKey in existingValue)) {
                                existingValue[subKey] = newValue[subKey];
                            }
                        });
                    }
                    else {
                        // Case: cached value is a store, new value is a primitive
                        signalCache.set(key, signal(newValue));
                    }
                }
                else {
                    // Case: cached value doesn't exist or is neither a signal nor a store
                    signalCache.set(key, typeof newValue === "object" && newValue !== null
                        ? createStore(newValue)
                        : signal(newValue));
                }
                return Reflect.set(target, key, newValue);
            }
            return Reflect.set(target, key, newValue);
        },
        deleteProperty(target, key) {
            if (typeof key === "symbol")
                return Reflect.deleteProperty(target, key);
            if (Object.prototype.hasOwnProperty.call(target, key)) {
                signalCache.delete(key);
                const result = Reflect.deleteProperty(target, key);
                return result;
            }
            return true;
        },
    });
    store[STORE] = signalCache;
    store[RAW] = initialState;
    return store;
}

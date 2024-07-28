import { createRoot, getCurrentScope } from "./core";
import { isSignal, createSignalWithinScope } from "./signals";
import { DISPOSE, NODE } from "./constants";
const STORE = Symbol("store");
const RAW = Symbol("raw");
export function isStore(value) {
    return typeof value === "object" && value !== null && STORE in value;
}
function createReactive(value, scope) {
    if (isSignal(value)) {
        value[NODE].updateScope(scope);
        return value;
    }
    return (typeof value === "object" && value !== null
        ? createStore(value)
        : createSignalWithinScope(value, scope));
}
export function createStore(initialState) {
    return createRoot((dispose) => {
        const scope = getCurrentScope();
        const signalCache = new Map();
        const disposals = new Map();
        const handleNewValue = (key, newValue) => {
            const newReactive = createReactive(newValue, scope);
            disposals.get(key)?.(); //dispose old value if present
            signalCache.set(key, newReactive);
            disposals.set(key, newReactive[DISPOSE].bind(newReactive));
            return newReactive;
        };
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
                        handleNewValue(key, target[key]);
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
                            handleNewValue(key, newValue);
                        }
                        else {
                            existingValue.set(newValue);
                        }
                    }
                    else if (isStore(existingValue)) {
                        if (typeof newValue === "object" && newValue !== null) {
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
                    return Reflect.set(target, key, newValue);
                }
                return Reflect.set(target, key, newValue);
            },
            deleteProperty(target, key) {
                if (typeof key === "symbol")
                    return Reflect.deleteProperty(target, key);
                if (Object.prototype.hasOwnProperty.call(target, key)) {
                    disposals.get(key)?.();
                    disposals.delete(key);
                    signalCache.delete(key);
                    return Reflect.deleteProperty(target, key);
                }
                return true;
            },
        });
        store[STORE] = signalCache;
        store[RAW] = initialState;
        store[DISPOSE] = dispose;
        return store;
    });
}
export function unWrap(store) {
    return store[RAW];
}

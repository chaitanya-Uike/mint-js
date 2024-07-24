import { signal, isSignal, createEffect } from "./signals";
function createStore(initialState) {
    const store = {};
    const signalCache = new WeakMap();
    function wrapInProxy(target, parentSignal, parentProp) {
        if (signalCache.has(target)) {
            return signalCache.get(target);
        }
        const objectSignal = parentSignal && parentProp
            ? createComputedSignal(() => parentSignal()[parentProp])
            : signal(target);
        const handler = {
            get(_, prop) {
                if (typeof prop === "symbol" || prop.startsWith("__")) {
                    return Reflect.get(target, prop);
                }
                const currentTarget = objectSignal();
                if (!(prop in store)) {
                    const value = Reflect.get(currentTarget, prop);
                    if (typeof value === "object" && value !== null) {
                        store[prop] = wrapInProxy(value, objectSignal, prop);
                    }
                    else {
                        store[prop] = createComputedSignal(() => objectSignal()[prop]);
                    }
                }
                const signalOrProxy = store[prop];
                return isSignal(signalOrProxy) ? signalOrProxy() : signalOrProxy;
            },
            set(_, prop, value) {
                if (typeof prop === "symbol" || prop.startsWith("__")) {
                    return Reflect.set(target, prop, value);
                }
                const currentTarget = objectSignal();
                let newTarget = { ...currentTarget };
                if (typeof value === "object" && value !== null) {
                    newTarget[prop] = { ...value };
                }
                else {
                    newTarget[prop] = value;
                }
                objectSignal.set(newTarget);
                return true;
            },
            deleteProperty(_, prop) {
                if (typeof prop === "symbol" || prop.startsWith("__")) {
                    return Reflect.deleteProperty(target, prop);
                }
                const currentTarget = objectSignal();
                const newTarget = { ...currentTarget };
                delete newTarget[prop];
                delete store[prop];
                objectSignal.set(newTarget);
                return true;
            },
        };
        const proxiedStore = new Proxy({}, handler);
        signalCache.set(target, proxiedStore);
        return proxiedStore;
    }
    function createComputedSignal(getter) {
        let cachedValue;
        const derivedSignal = signal(getter());
        createEffect(() => {
            const newValue = getter();
            if (newValue !== cachedValue) {
                cachedValue = newValue;
                derivedSignal.set(newValue);
            }
        });
        return derivedSignal;
    }
    return wrapInProxy(initialState);
}
export { createStore };

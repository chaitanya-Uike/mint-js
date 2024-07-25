import { signal } from "./signals";
const STORE = Symbol("store");
export function createStore(initialState) {
    const store = {};
    const proxy = new Proxy(initialState, {
        get(target, prop) {
            if (prop === STORE)
                return true;
            if (!(prop in store)) {
                store[prop] = signal(target[prop]);
            }
            return store[prop]();
        },
        set(target, prop, value) {
            if (prop in store) {
                store[prop].set(value);
            }
            else {
                store[prop] = signal(value);
            }
            return true;
        },
    });
    return proxy;
}
export function isStore(value) {
    return typeof value === "object" && value !== null && value[STORE] === true;
}

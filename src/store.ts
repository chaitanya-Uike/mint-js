import { createRoot, getCurrentScope, Root } from "./core";
import { isSignal, createSignalWithinScope, Signal } from "./signals";
import { DISPOSE, NODE } from "./constants";

const STORE = Symbol("store");
const RAW = Symbol("raw");

type disposeFn = () => void;

export type Store<T extends object> = T & {
  [STORE]: Map<string, any>;
  [RAW]: T;
  [DISPOSE]: disposeFn;
};

export function isStore(value: any): value is Store<any> {
  return typeof value === "object" && value !== null && STORE in value;
}

function createReactive<T>(
  value: T | Signal<T>,
  scope: Root | null
): T extends object ? Store<T> : Signal<T> {
  if (isSignal(value)) {
    value[NODE].updateScope(scope);
    return value as any;
  }
  return (
    typeof value === "object" && value !== null
      ? createStore(value as object)
      : createSignalWithinScope(value, scope)
  ) as any;
}

export function createStore<T extends object>(initialState: T): Store<T> {
  return createRoot((dispose) => {
    const scope = getCurrentScope();
    const signalCache = new Map<string, any>();
    const disposals = new Map<string, disposeFn>();

    const handleNewValue = (key: string, newValue: any) => {
      const newReactive = createReactive(newValue, scope);
      disposals.get(key)?.(); //dispose old value if present
      signalCache.set(key, newReactive);
      disposals.set(key, newReactive[DISPOSE].bind(newReactive));
      return newReactive;
    };

    const store = new Proxy(initialState, {
      get(target: T, key: string | symbol) {
        if (key === RAW) return target;
        if (key === STORE) return signalCache;
        if (typeof key === "symbol") return Reflect.get(target, key);

        if (Object.prototype.hasOwnProperty.call(target, key)) {
          if (!signalCache.has(key)) {
            handleNewValue(key, target[key as keyof T]);
          }
          const cachedValue = signalCache.get(key);
          return isSignal(cachedValue) ? cachedValue() : cachedValue;
        }

        return Reflect.get(target, key);
      },
      set(target: T, key: string | symbol, newValue: any): boolean {
        if (typeof key === "symbol") return Reflect.set(target, key, newValue);

        if (Object.prototype.hasOwnProperty.call(target, key)) {
          const existingValue = signalCache.get(key);

          if (isSignal(existingValue)) {
            if (typeof newValue === "object" && newValue !== null) {
              handleNewValue(key, newValue);
            } else {
              existingValue.set(newValue);
            }
          } else if (isStore(existingValue)) {
            if (typeof newValue === "object" && newValue !== null) {
              const existingKeys = new Set(Object.keys(existingValue));

              Object.entries(newValue).forEach(([subKey, subValue]) => {
                existingValue[subKey] = subValue;
                existingKeys.delete(subKey);
              });
              existingKeys.forEach((subKey) => {
                delete existingValue[subKey];
              });
            } else {
              handleNewValue(key, newValue);
            }
          } else {
            handleNewValue(key, newValue);
          }

          return Reflect.set(target, key, newValue);
        }

        return Reflect.set(target, key, newValue);
      },
      deleteProperty(target: T, key: string | symbol): boolean {
        if (typeof key === "symbol") return Reflect.deleteProperty(target, key);
        if (Object.prototype.hasOwnProperty.call(target, key)) {
          disposals.get(key)?.();
          disposals.delete(key);
          signalCache.delete(key);
          return Reflect.deleteProperty(target, key);
        }
        return true;
      },
    }) as Store<T>;

    store[STORE] = signalCache;
    store[RAW] = initialState;
    store[DISPOSE] = dispose;
    return store;
  });
}

export function unWrap<T extends object>(store: Store<T>) {
  return store[RAW];
}

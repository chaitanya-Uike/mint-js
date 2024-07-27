import { signal } from "./signals";

const STORE = Symbol("store");
const RAW = Symbol("raw");

type Store<T extends object> = T & {
  [STORE]: Map<string, any>;
  [RAW]: T;
};

function isSignal(value: any): value is ReturnType<typeof signal> {
  return typeof value === "function" && "set" in value;
}

function isStore(value: any): value is Store<any> {
  return typeof value === "object" && value !== null && STORE in value;
}

export function createStore<T extends object>(initialState: T): Store<T> {
  const signalCache = new Map<string, any>();

  const store = new Proxy(initialState, {
    get(target: T, key: string | symbol) {
      if (key === RAW) return target;
      if (key === STORE) return signalCache;
      if (typeof key === "symbol") return Reflect.get(target, key);

      if (Object.prototype.hasOwnProperty.call(target, key)) {
        if (!signalCache.has(key as string)) {
          const value = target[key as keyof T];
          signalCache.set(
            key as string,
            typeof value === "object" && value !== null
              ? createStore(value as object)
              : signal(value)
          );
        }
        const cachedValue = signalCache.get(key as string);
        return isSignal(cachedValue) ? cachedValue() : cachedValue;
      }

      return Reflect.get(target, key);
    },
    set(target: T, key: string | symbol, newValue: any): boolean {
      if (typeof key === "symbol") return Reflect.set(target, key, newValue);

      if (Object.prototype.hasOwnProperty.call(target, key)) {
        const existingValue = signalCache.get(key as string);

        if (isSignal(existingValue)) {
          if (typeof newValue === "object" && newValue !== null) {
            // Case: cached value is a signal, new value is an object
            const newStore = createStore(newValue);
            signalCache.set(key as string, newStore);
          } else {
            // Case: cached value is a signal, new value is a primitive
            existingValue.set(newValue);
          }
        } else if (isStore(existingValue)) {
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
          } else {
            // Case: cached value is a store, new value is a primitive
            signalCache.set(key as string, signal(newValue));
          }
        } else {
          // Case: cached value doesn't exist or is neither a signal nor a store
          signalCache.set(
            key as string,
            typeof newValue === "object" && newValue !== null
              ? createStore(newValue)
              : signal(newValue)
          );
        }

        return Reflect.set(target, key, newValue);
      }

      return Reflect.set(target, key, newValue);
    },
    deleteProperty(target: T, key: string | symbol): boolean {
      if (typeof key === "symbol") return Reflect.deleteProperty(target, key);
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        signalCache.delete(key as string);
        const result = Reflect.deleteProperty(target, key);
        return result;
      }
      return true;
    },
  }) as Store<T>;

  store[STORE] = signalCache;
  store[RAW] = initialState;

  return store;
}

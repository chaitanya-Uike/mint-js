import { DISPOSE, NODE } from "../constants";
import { Cleanup, createRoot, getCurrentScope, onCleanup, Root } from "../core";
import { createSignalWithinScope, isSignal, Signal } from "../signals";
import { getSignalCache, SignalCache } from "./cache";

const CACHE = Symbol("signal-cache");
const SCOPE = Symbol("store-scope");

export type Store<T extends object = object> = T & {
  [SCOPE]: Root;
  [CACHE]: SignalCache;
  [DISPOSE]: Cleanup;
  [key: PropertyKey]: any;
};

export type Reactive<T = any> = T extends Signal<any>
  ? T
  : T extends object
  ? Store<T>
  : Signal<T>;

function isWrappable(obj: unknown): obj is object {
  return (
    obj != null &&
    typeof obj === "object" &&
    (Object.getPrototypeOf(obj) === Object.prototype || Array.isArray(obj))
  );
}

function isTrackable<T extends object>(
  target: T,
  prop: PropertyKey,
  receiver: any
): boolean {
  const value = Reflect.get(target, prop, receiver);
  const descriptor = Object.getOwnPropertyDescriptor(target, prop);
  return (
    isSignal(value) ||
    isStore(value) ||
    (typeof value !== "function" &&
      Object.prototype.hasOwnProperty.call(target, prop) &&
      !(descriptor && descriptor.get))
  );
}

function updateStoreScope(store: Store, scope: Root): void {
  if (store[SCOPE] === scope) return;
  for (const [, value] of store[CACHE]) {
    if (isSignal(value)) value[NODE].updateScope(scope);
    else if (isStore(value)) updateStoreScope(value, scope);
  }
  store[SCOPE] = scope;
}

export function isStore(value: unknown): value is Store {
  return (
    typeof value === "object" &&
    value !== null &&
    SCOPE in value &&
    CACHE in value
  );
}

function createReactive<T>(target: Store, value: T): Reactive<T> {
  const scope = target[SCOPE];
  if (isSignal(value)) {
    value[NODE].updateScope(scope);
    return value as Reactive<T>;
  }
  if (isStore(value)) {
    updateStoreScope(value, scope);
    return value as Reactive<T>;
  }
  return isWrappable(value)
    ? (store(value as T & object) as Reactive<T>)
    : (createSignalWithinScope(value, scope) as Reactive<T>);
}

function getReactive<T>(
  target: Store,
  prop: PropertyKey,
  value: T
): Reactive<T> {
  if (target[CACHE].has(prop)) return target[CACHE].get(prop)!;
  return target[CACHE].set(prop, createReactive(target, value));
}

const proxyHandler: ProxyHandler<Store> = {
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
    if (prop === SCOPE || prop === CACHE || prop === DISPOSE) return true;
    return Reflect.has(target, prop);
  },
};

function mergeValue<T>(
  target: Store,
  existing: any,
  newValue: T | (T extends object ? object : never)
): Reactive<T> {
  if (isSignal(existing)) {
    if (isSignal(newValue) || isStore(newValue) || isWrappable(newValue))
      return createReactive(target, newValue as T);
    existing.set(newValue as T);
    return existing as Reactive<T>;
  } else if (isStore(existing)) {
    if (!isStore(newValue) && isWrappable(newValue)) {
      const existingKeys = new Set(Object.keys(existing));
      Object.entries(newValue as object).forEach(([subKey, subValue]) => {
        existing[subKey] = subValue;
        existingKeys.delete(subKey);
      });
      existingKeys.forEach((subKey) => {
        delete existing[subKey];
      });
      return existing as Reactive<T>;
    }
    return createReactive(target, newValue as T);
  }
  return createReactive(target, newValue as T);
}

function wrap<T extends object>(value: Store<T>): Store<T> {
  const proxy = new Proxy(value, proxyHandler) as Store<T>;
  const keys = Object.keys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const prop of keys) {
    if (descriptors[prop]?.get) {
      descriptors[prop].get = descriptors[prop].get!.bind(proxy);
    }
  }
  return proxy;
}

export function store<T extends object>(initValue: T): Store<T> {
  if (!isWrappable(initValue)) {
    throw new TypeError("Initial value must be a wrappable object");
  }

  return createRoot((dispose) => {
    const store = initValue as Store<T>;
    const scope = getCurrentScope()!;

    const cache = getSignalCache(initValue);

    store[SCOPE] = scope;
    store[CACHE] = cache;

    const disposer = () => {
      cache.clear();
      dispose();
    };

    onCleanup(disposer);
    store[DISPOSE] = disposer;

    return wrap(store);
  });
}

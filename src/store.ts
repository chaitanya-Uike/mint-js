import { ScopeNode } from "./core";
import { NODE } from "./constants";
import { isSignal, signal, Signal } from "./signals";

const STORE = Symbol("store");

type UnwrapSignal<T> = T extends Signal<infer U> ? U : T;

type DeepUnwrapSignals<T> = T extends object
  ? { [K in keyof T]: DeepUnwrapSignals<UnwrapSignal<T[K]>> }
  : UnwrapSignal<T>;

type StoreMetadata = { [STORE]: true; [NODE]: StoreNode };

export type Store<T extends object = {}> = DeepUnwrapSignals<T> & StoreMetadata;

type Reactive<T = any> = T extends object ? Store<T> : Signal<T>;

export class StoreNode extends ScopeNode {
  private objectCache: Map<PropertyKey, Reactive>;
  private arrayCache: Reactive[];

  constructor() {
    super();
    this.objectCache = new Map();
    this.arrayCache = [];
  }

  get(key: PropertyKey) {
    return isArrayIndex(key)
      ? this.arrayCache[Number(key)]
      : this.objectCache.get(key);
  }

  set(key: PropertyKey, value: Reactive): StoreNode {
    this.get(key)?.[NODE].dispose();
    value[NODE].updateScope(this);
    if (isArrayIndex(key)) this.arrayCache[Number(key)] = value;
    else this.objectCache.set(key, value);
    return this;
  }

  has(key: PropertyKey) {
    if (isArrayIndex(key)) return key in this.arrayCache;
    return this.objectCache.has(key);
  }

  delete(key: PropertyKey) {
    if (!this.has(key)) return false;
    this.get(key)![NODE].dispose();
    if (isArrayIndex(key) && key in this.arrayCache)
      this.arrayCache.splice(Number(key), 1);
    else this.objectCache.delete(key);
    return true;
  }

  updateScope(newScope: ScopeNode | null): void {
    if (this.scope === newScope) return;
    for (const [, entry] of this.objectCache) entry[NODE].updateScope(newScope);
    for (const entry of this.arrayCache) entry[NODE].updateScope(newScope);
    super.updateScope(newScope);
  }

  dispose(): void {
    for (const [, entry] of this.objectCache) entry[NODE].dispose();
    for (const entry of this.arrayCache) entry[NODE].dispose();
    this.objectCache.clear();
    this.arrayCache.length = 0;
    super.dispose();
  }

  updateArrayCacheLength(newLength: number) {
    if (newLength < this.arrayCache.length) {
      for (let i = this.arrayCache.length - 1; i >= newLength; i--) {
        this.arrayCache[i]?.[NODE].dispose();
      }
      this.arrayCache.length = newLength;
    }
  }
}

function isArrayIndex(key: PropertyKey): boolean {
  if (typeof key === "symbol") return false;
  const num = Number(key);
  return Number.isInteger(num) && num >= 0 && num < 2 ** 32 - 1;
}

function createReactive(value: any): Reactive {
  if (isSignal(value) || isStore(value)) return value;
  return isWrappable(value) ? store(value) : signal(value);
}

const createStoreProxy = <T extends object>(initValue: Store<T>) => {
  const proxyHandler: ProxyHandler<Store<T>> = {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (key === STORE || key === NODE) return value;
      if (isTrackable(target, key, receiver)) {
        const storeNode = target[NODE];
        if (!storeNode.has(key)) {
          storeNode.set(key, createReactive(value));
        }
        const reactive = storeNode.get(key)!;
        return isSignal(reactive) ? reactive() : reactive;
      }
      return value;
    },
    set(target, key, newValue, receiver) {
      const storeNode = target[NODE];
      const result = Reflect.set(target, key, newValue, receiver);
      if (key === STORE || key === NODE) return result;

      if (isTrackable(target, key, receiver)) {
        handleUpdate(target, key, newValue);
      }

      if (Array.isArray(target) && key === "length") {
        storeNode.updateArrayCacheLength(newValue);
      }

      return result;
    },
    deleteProperty(target, key) {
      target[NODE].delete(key);
      return Reflect.deleteProperty(target, key);
    },
    has(target, prop) {
      return Reflect.has(target, prop);
    },
  };
  return new Proxy(initValue, proxyHandler);
};

export function store<T extends object = {}>(initValue: T): Store<T> {
  const value = initValue as Store<T>;
  value[STORE] = true;
  value[NODE] = new StoreNode();
  const proxy = createStoreProxy(value);
  const keys = Object.keys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const prop of keys) {
    if (descriptors[prop]?.get) {
      descriptors[prop].get = descriptors[prop].get!.bind(proxy);
    }
  }
  return proxy;
}

export function isStore(value: unknown): value is Store<any> {
  return (
    typeof value === "object" &&
    value !== null &&
    STORE in value &&
    NODE in value
  );
}

function isWrappable(obj: unknown) {
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

function handleUpdate<T extends object>(
  target: Store<T>,
  key: PropertyKey,
  newValue: any
): void {
  const storeNode = target[NODE];

  if (!storeNode.has(key)) {
    storeNode.set(key, createReactive(newValue));
    return;
  }

  const existing = storeNode.get(key)!;

  if (isSignal(existing)) {
    handleExistingSignal(storeNode, key, newValue);
    return;
  }

  if (isStore(newValue) || isWrappable(newValue)) {
    mergeStore(storeNode, key, existing, newValue);
  } else {
    storeNode.set(key, createReactive(newValue));
    if (Array.isArray(existing)) {
      storeNode.delete("length");
    }
  }
}

function handleExistingSignal(
  storeNode: StoreNode,
  key: PropertyKey,
  newValue: any
) {
  if (isSignal(newValue) || isStore(newValue) || isWrappable(newValue)) {
    storeNode.set(key, createReactive(newValue));
  } else {
    const existing = storeNode.get(key) as Signal<any>;
    existing.set(newValue);
  }
}

function mergeStore(
  storeNode: StoreNode,
  key: PropertyKey,
  existing: any,
  newValue: any
): void {
  if (Array.isArray(existing) && Array.isArray(newValue)) {
    newValue.forEach((value, index) => (existing[index] = value));
    existing.length = newValue.length;
  } else if (isObject(existing) && isObject(newValue)) {
    const existingKeys = new Set(Object.keys(existing));
    Object.entries(newValue).forEach(([key, value]) => {
      existing[key] = value;
      existingKeys.delete(key);
    });
    existingKeys.forEach((key) => {
      delete existing[key];
    });
  } else {
    storeNode.set(key, createReactive(newValue));
    if (Array.isArray(existing)) {
      storeNode.delete("length");
    }
  }
}

function isObject(value: any): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

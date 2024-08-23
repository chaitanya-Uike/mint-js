import { DISPOSE } from "../constants";
import { CleanupFn } from "../core";
import { Reactive } from ".";

type CacheEntry = {
  value: Reactive;
  dispose: CleanupFn;
};

export interface SignalCache {
  get(key: PropertyKey): Reactive | undefined;
  set(key: PropertyKey, newValue: Reactive): Reactive;
  delete(key: PropertyKey): void;
  has(key: PropertyKey): boolean;
  size(): number;
  clear(): void;
  [Symbol.iterator](): Iterator<[string, Reactive]>;
}

class ObjectCache implements SignalCache {
  protected cache: Map<PropertyKey, CacheEntry>;
  constructor() {
    this.cache = new Map();
  }
  get(key: PropertyKey): Reactive | undefined {
    return this.cache.get(key)?.value;
  }
  set(key: PropertyKey, newValue: Reactive): Reactive {
    if (this.get(key) === newValue) return newValue;
    this.cache.get(key)?.dispose();
    this.cache.set(key, {
      value: newValue,
      dispose: newValue[DISPOSE].bind(newValue),
    });
    return newValue;
  }
  delete(key: PropertyKey): void {
    this.cache.get(key)?.dispose();
    this.cache.delete(key);
  }
  has(key: PropertyKey): boolean {
    return this.cache.has(key);
  }
  size(): number {
    return this.cache.size;
  }
  clear() {
    for (const [, entry] of this.cache) entry.dispose();
    this.cache.clear();
  }
  *[Symbol.iterator](): Iterator<[string, Reactive]> {
    for (const [key, entry] of this.cache) {
      yield [String(key), entry.value];
    }
  }
}

class ArrayCache implements SignalCache {
  private arrayCache: CacheEntry[];
  private objectCache: ObjectCache;
  constructor() {
    this.arrayCache = [];
    this.objectCache = new ObjectCache();
  }
  private isArrayIndex(key: PropertyKey): boolean {
    if (typeof key === "symbol") return false;
    const num = Number(key);
    return Number.isInteger(num) && num >= 0 && num < 2 ** 32 - 1;
  }
  get(key: PropertyKey): Reactive | undefined {
    if (this.isArrayIndex(key)) {
      return this.arrayCache[Number(key)]?.value;
    }
    return this.objectCache.get(key);
  }
  set(key: PropertyKey, newValue: Reactive): Reactive {
    if (this.get(key) === newValue) return newValue;
    if (this.isArrayIndex(key)) {
      const index = Number(key);
      this.arrayCache[index]?.dispose();
      this.arrayCache[index] = {
        value: newValue,
        dispose: newValue[DISPOSE].bind(newValue),
      };
    } else {
      this.objectCache.set(key, newValue);
    }
    return newValue;
  }
  delete(key: PropertyKey): void {
    if (this.isArrayIndex(key)) {
      const index = Number(key);
      this.arrayCache[index]?.dispose();
      this.arrayCache.splice(index, 1);
    } else {
      this.objectCache.delete(key);
    }
  }
  has(key: PropertyKey): boolean {
    if (this.isArrayIndex(key)) {
      return Number(key) in this.arrayCache;
    }
    return this.objectCache.has(key);
  }
  size(): number {
    return (
      this.arrayCache.filter((entry) => entry !== undefined).length +
      this.objectCache.size()
    );
  }
  clear(): void {
    for (const entry of this.arrayCache) entry.dispose();
    this.arrayCache.length = 0;
    this.objectCache.clear();
  }
  *[Symbol.iterator](): Iterator<[string, Reactive]> {
    for (let i = 0; i < this.arrayCache.length; i++) {
      const entry = this.arrayCache[i];
      if (entry !== undefined) {
        yield [String(i), entry.value];
      }
    }
    for (const [key, value] of this.objectCache) {
      if (!this.isArrayIndex(key)) {
        yield [key, value];
      }
    }
  }
}

export function getSignalCache<T extends object>(initValue: T): SignalCache {
  return Array.isArray(initValue) ? new ArrayCache() : new ObjectCache();
}

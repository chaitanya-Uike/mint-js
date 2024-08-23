import { Disposable } from "../core";

export interface SignalCache {
  get(key: PropertyKey): Disposable | undefined;
  set(key: PropertyKey, newValue: Disposable): void;
  delete(key: PropertyKey): boolean;
  has(key: PropertyKey): boolean;
  clear(): void;
  [Symbol.iterator](): Iterator<[PropertyKey, Disposable]>;
}

class ObjectCache {
  protected cache: Map<PropertyKey, Disposable>;
  constructor() {
    this.cache = new Map();
  }
  get(key: PropertyKey) {
    return this.cache.get(key);
  }
  set(key: PropertyKey, newValue: Disposable): SignalCache {
    if (this.get(key) === newValue) return this;
    this.cache.get(key)?.dispose();
    this.cache.set(key, newValue);
    return this;
  }
  delete(key: PropertyKey) {
    this.cache.get(key)?.dispose();
    return this.cache.delete(key);
  }
  has(key: PropertyKey) {
    return this.cache.has(key);
  }
  clear() {
    for (const [, entry] of this.cache) entry.dispose();
    this.cache.clear();
  }
  [Symbol.iterator](): Iterator<[PropertyKey, Disposable]> {
    return this.cache.entries();
  }
}

class ArrayCache extends ObjectCache {
  private arrayCache: Disposable[];
  constructor() {
    super();
    this.arrayCache = [];
  }
  private isArrayIndex(key: PropertyKey) {
    if (typeof key === "symbol") return false;
    const num = Number(key);
    return Number.isInteger(num) && num >= 0 && num < 2 ** 32 - 1;
  }
  get(key: PropertyKey) {
    return this.isArrayIndex(key)
      ? this.arrayCache[Number(key)]
      : super.get(key);
  }
  set(key: PropertyKey, newValue: Disposable) {
    if (this.get(key) === newValue) return this;
    this.get(key)?.dispose();
    if (this.isArrayIndex(key)) this.arrayCache[Number(key)] = newValue;
    else super.set(key, newValue);
    return this;
  }
  delete(key: PropertyKey): boolean {
    if (!this.has(key)) return false;
    if (this.isArrayIndex(key)) {
      this.get(key)!.dispose();
      this.arrayCache.splice(Number(key), 1);
      return true;
    }
    return super.delete(key);
  }
  has(key: PropertyKey): boolean {
    return this.isArrayIndex(key)
      ? Number(key) in this.arrayCache
      : super.has(key);
  }
  clear(): void {
    for (const entry of this.arrayCache) entry.dispose();
    this.arrayCache.length = 0;
    super.clear();
  }
  *[Symbol.iterator](): IterableIterator<[PropertyKey, Disposable]> {
    for (let i = 0; i < this.arrayCache.length; i++) {
      if (this.arrayCache[i] !== undefined) {
        yield [i, this.arrayCache[i]];
      }
    }
    yield* this.cache.entries();
  }
}

export function getSignalCache(initValue: any): SignalCache {
  return Array.isArray(initValue) ? new ArrayCache() : new ObjectCache();
}

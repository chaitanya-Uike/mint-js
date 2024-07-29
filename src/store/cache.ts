import { Store } from ".";
import { effect } from "../core";
import { signal, Signal } from "../signals";

type DisposeFn = () => void;

interface CacheEntry {
  value: Store | Signal;
  dispose: DisposeFn;
}

export interface SignalCache {
  get(key: string | number): Store | Signal | undefined;
  set(key: string | number, value: Store | Signal, disposeFn: DisposeFn): void;
  delete(key: string | number): void;
  has(key: string | number): boolean;
  size(): number;
  [Symbol.iterator](): Iterator<[string, Store | Signal]>;
}

class ArrayCache implements SignalCache {
  private cache: CacheEntry[];
  private lengthSignal: Signal<number>;

  constructor() {
    this.cache = [];
    this.lengthSignal = signal(0);
  }

  get(key: string | number): Signal | Store | undefined {
    if (key === "length") return this.lengthSignal;
    const index = this.parseIndex(key);
    return this.cache[index]?.value;
  }

  set(key: string | number, value: Signal | Store, disposeFn: DisposeFn) {
    const index = this.parseIndex(key);
    if (index !== -1) {
      const entry: CacheEntry = { value, dispose: disposeFn };
      this.cache[index]?.dispose();
      this.cache[index] = entry;
    }
  }

  delete(key: string | number) {
    const index = this.parseIndex(key);
    if (index in this.cache) {
      this.cache[index].dispose();
      this.cache.splice(index, 1);
    }
  }

  has(key: string | number) {
    if (key === "length") return true;
    return Number(key) in this.cache;
  }

  size() {
    return this.cache.length;
  }

  private parseIndex(key: string | number): number {
    const index = Number(key);
    return !isNaN(index) && index >= 0 && index === Math.floor(index)
      ? index
      : -1;
  }

  *[Symbol.iterator](): Iterator<Signal | Store> {
    for (let i = 0; i < this.cache.length; i++) {
      yield this.cache[i].value;
    }
    yield this.lengthSignal;
  }
}

class ObjectCache implements SignalCache {
  private cache: Map<string, CacheEntry>;

  constructor() {
    this.cache = new Map<string, CacheEntry>();
  }

  get(key: string | number) {
    return this.cache.get(String(key))?.value;
  }

  set(key: string | number, value: any, disposeFn: DisposeFn) {
    const entry: CacheEntry = { value, dispose: disposeFn };
    const stringKey = String(key);
    this.cache.get(stringKey)?.dispose();
    this.cache.set(stringKey, entry);
  }

  delete(key: string | number) {
    const stringKey = String(key);
    this.cache.get(stringKey)?.dispose();
    this.cache.delete(stringKey);
  }

  has(key: string | number) {
    return this.cache.has(String(key));
  }

  size() {
    return this.cache.size;
  }

  *[Symbol.iterator](): Iterator<Store | Signal> {
    for (const [_, entry] of this.cache) {
      yield entry;
    }
  }
}

export function getSignalCache<T extends object>(initialState: T): SignalCache {
  return Array.isArray(initialState) ? new ArrayCache() : new ObjectCache();
}

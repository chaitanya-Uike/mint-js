import { DISPOSE } from "../constants";
class ObjectCache {
    cache;
    constructor() {
        this.cache = new Map();
    }
    get(key) {
        return this.cache.get(key)?.value;
    }
    set(key, newValue) {
        if (this.get(key) === newValue)
            return newValue;
        this.cache.get(key)?.dispose();
        this.cache.set(key, {
            value: newValue,
            dispose: newValue[DISPOSE].bind(newValue),
        });
        return newValue;
    }
    delete(key) {
        this.cache.get(key)?.dispose();
        this.cache.delete(key);
    }
    has(key) {
        return this.cache.has(key);
    }
    size() {
        return this.cache.size;
    }
    clear() {
        this.cache.clear();
    }
    *[Symbol.iterator]() {
        for (const [key, entry] of this.cache) {
            yield [String(key), entry.value];
        }
    }
}
class ArrayCache {
    arrayCache;
    objectCache;
    constructor() {
        this.arrayCache = [];
        this.objectCache = new ObjectCache();
    }
    isArrayIndex(key) {
        if (typeof key === "symbol")
            return false;
        const num = Number(key);
        return Number.isInteger(num) && num >= 0 && num < 2 ** 32 - 1;
    }
    get(key) {
        if (this.isArrayIndex(key)) {
            return this.arrayCache[Number(key)]?.value;
        }
        return this.objectCache.get(key);
    }
    set(key, newValue) {
        if (this.get(key) === newValue)
            return newValue;
        if (this.isArrayIndex(key)) {
            const index = Number(key);
            this.arrayCache[index]?.dispose();
            this.arrayCache[index] = {
                value: newValue,
                dispose: newValue[DISPOSE].bind(newValue),
            };
        }
        else {
            this.objectCache.set(key, newValue);
        }
        return newValue;
    }
    delete(key) {
        if (this.isArrayIndex(key)) {
            const index = Number(key);
            this.arrayCache[index]?.dispose();
            this.arrayCache.splice(index, 1);
        }
        else {
            this.objectCache.delete(key);
        }
    }
    has(key) {
        if (this.isArrayIndex(key)) {
            return Number(key) in this.arrayCache;
        }
        return this.objectCache.has(key);
    }
    size() {
        return (this.arrayCache.filter((entry) => entry !== undefined).length +
            this.objectCache.size());
    }
    clear() {
        this.arrayCache.length = 0;
        this.objectCache.clear();
    }
    *[Symbol.iterator]() {
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
export function getSignalCache(initValue) {
    return Array.isArray(initValue) ? new ArrayCache() : new ObjectCache();
}

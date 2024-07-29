import { signal } from "../signals";
class ArrayCache {
    cache;
    lengthSignal;
    constructor() {
        this.cache = [];
        this.lengthSignal = signal(0);
    }
    get(key) {
        if (key === "length")
            return this.lengthSignal;
        const index = this.parseIndex(key);
        return this.cache[index]?.value;
    }
    set(key, value, disposeFn) {
        const index = this.parseIndex(key);
        if (index !== -1) {
            const entry = { value, dispose: disposeFn };
            this.cache[index]?.dispose();
            this.cache[index] = entry;
        }
    }
    delete(key) {
        const index = this.parseIndex(key);
        if (index in this.cache) {
            this.cache[index].dispose();
            this.cache.splice(index, 1);
        }
    }
    has(key) {
        if (key === "length")
            return true;
        return Number(key) in this.cache;
    }
    size() {
        return this.cache.length;
    }
    parseIndex(key) {
        const index = Number(key);
        return !isNaN(index) && index >= 0 && index === Math.floor(index)
            ? index
            : -1;
    }
    *[Symbol.iterator]() {
        for (let i = 0; i < this.cache.length; i++) {
            yield this.cache[i].value;
        }
        yield this.lengthSignal;
    }
}
class ObjectCache {
    cache;
    constructor() {
        this.cache = new Map();
    }
    get(key) {
        return this.cache.get(String(key))?.value;
    }
    set(key, value, disposeFn) {
        const entry = { value, dispose: disposeFn };
        const stringKey = String(key);
        this.cache.get(stringKey)?.dispose();
        this.cache.set(stringKey, entry);
    }
    delete(key) {
        const stringKey = String(key);
        this.cache.get(stringKey)?.dispose();
        this.cache.delete(stringKey);
    }
    has(key) {
        return this.cache.has(String(key));
    }
    size() {
        return this.cache.size;
    }
    *[Symbol.iterator]() {
        for (const [_, entry] of this.cache) {
            yield entry;
        }
    }
}
export function getSignalCache(initialState) {
    return Array.isArray(initialState) ? new ArrayCache() : new ObjectCache();
}

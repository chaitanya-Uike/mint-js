import { effect, flush, store, Signal, StoreNode, signal } from "../src";
import { createRoot, ReactiveNode } from "../src/core";
import * as signals from "../src/signals";

describe("store", () => {
  let signalFn: jest.SpyInstance;
  let disposeFn: jest.SpyInstance;
  let storeDisposeFn: jest.SpyInstance;

  beforeEach(() => {
    signalFn = jest.spyOn(signals, "signal");
    disposeFn = jest.spyOn(ReactiveNode.prototype, "dispose");
    storeDisposeFn = jest.spyOn(StoreNode.prototype, "dispose");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should make properties reactive", () => {
    const $store = store({ a: 100 });
    const effectFn = jest.fn();

    effect(() => effectFn($store.a));

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith(100);

    $store.a = 20;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith(20);
  });

  it("should lazily create signals", () => {
    const $store = store({ a: 10, b: "hello" });

    expect(signalFn.mock.calls.length).toBe(0);

    $store.a; //access property to create signal

    expect(signalFn.mock.calls.length).toBe(1);
    expect(signalFn.mock.lastCall?.[0]).toBe(10);

    $store.b;

    expect(signalFn.mock.calls.length).toBe(2);
    expect(signalFn.mock.lastCall?.[0]).toBe("hello");
  });

  it("should allow nested properties", () => {
    const $store = store({ a: { b: { c: 10 } } });
    const effectFn = jest.fn();

    effect(() => effectFn($store.a.b.c));

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith(10);

    $store.a.b.c = 20;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith(20);
  });

  it("should allow assignment of object properties", () => {
    const $store = store({ a: { b: 10, c: { d: "hello" } } });
    const effect1 = jest.fn();
    const effect2 = jest.fn();

    effect(() => effect1($store.a.b));
    effect(() => effect2($store.a.c.d));

    expect(effect1).toHaveBeenCalledTimes(1);
    expect(effect1).toHaveBeenLastCalledWith(10);
    expect(effect2).toHaveBeenCalledTimes(1);
    expect(effect2).toHaveBeenLastCalledWith("hello");

    $store.a = { b: 5, c: { d: "world" } };
    flush();

    expect(effect1).toHaveBeenCalledTimes(2);
    expect(effect1).toHaveBeenLastCalledWith(5);
    expect(effect2).toHaveBeenCalledTimes(2);
    expect(effect2).toHaveBeenLastCalledWith("world");
  });

  it("should work with arrays", () => {
    const $store = store([1, 2, 3]);
    const effectFn = jest.fn();

    effect(() => effectFn($store[0]));

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith(1);

    $store[0] = 5;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith(5);
  });

  it("should handle array length update correctly", () => {
    const $store = store([1, 2, 3]);
    const effectFn = jest.fn();

    effect(() => effectFn($store.length));

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith(3);

    $store.push(10);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith(4);

    $store.push(15, 20, 25, 30);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(3);
    expect(effectFn).toHaveBeenLastCalledWith(8);

    $store.pop();
    flush();
    expect(effectFn).toHaveBeenCalledTimes(4);
    expect(effectFn).toHaveBeenLastCalledWith(7);

    $store.shift();
    flush();
    expect(effectFn).toHaveBeenCalledTimes(5);
    expect(effectFn).toHaveBeenLastCalledWith(6);

    $store.length = 2;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(6);
    expect(effectFn).toHaveBeenLastCalledWith(2);
  });

  it("should dispose signals when length is updated", () => {
    const $store = store([1, 2, 3, 4]);
    const effectFn = jest.fn();

    effect(() => {
      effectFn();
      $store[2];
      $store[3];
    });

    expect(effectFn).toHaveBeenCalledTimes(1);

    $store.length = 2; //will dispose off extra elements
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1);

    effectFn.mockClear();

    effect(() => effectFn($store[1]));
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith(2);

    $store.pop();
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1);
  });

  it("should handle array methods correctly", () => {
    const $store = store([1, 2, 3, 4, 5]);
    const mapFn = jest.fn();
    const filterFn = jest.fn();
    const everyFn = jest.fn();

    effect(() => mapFn($store.map((x) => x * 2)));
    effect(() => filterFn($store.filter((x) => x % 2 === 0)));
    effect(() => everyFn($store.every((x) => x > 0)));

    expect(mapFn).toHaveBeenCalledTimes(1);
    expect(mapFn).toHaveBeenLastCalledWith([2, 4, 6, 8, 10]);
    expect(filterFn).toHaveBeenCalledTimes(1);
    expect(filterFn).toHaveBeenLastCalledWith([2, 4]);
    expect(everyFn).toHaveBeenCalledTimes(1);
    expect(everyFn).toHaveBeenLastCalledWith(true);

    $store.push(6);
    flush();
    expect(mapFn).toHaveBeenCalledTimes(2);
    expect(mapFn).toHaveBeenLastCalledWith([2, 4, 6, 8, 10, 12]);
    expect(filterFn).toHaveBeenCalledTimes(2);
    expect(filterFn).toHaveBeenLastCalledWith([2, 4, 6]);
    expect(everyFn).toHaveBeenCalledTimes(2);
    expect(everyFn).toHaveBeenLastCalledWith(true);

    $store[0] = -1;
    flush();
    expect(mapFn).toHaveBeenCalledTimes(3);
    expect(mapFn).toHaveBeenLastCalledWith([-2, 4, 6, 8, 10, 12]);
    expect(filterFn).toHaveBeenCalledTimes(3);
    expect(filterFn).toHaveBeenLastCalledWith([2, 4, 6]);
    expect(everyFn).toHaveBeenCalledTimes(3);
    expect(everyFn).toHaveBeenLastCalledWith(false);
  });

  it("should work with nested array properties", () => {
    const $store = store({ a: [5, 6, 7] });
    const effect1 = jest.fn();
    const effect2 = jest.fn();

    effect(() => effect1($store.a.length));
    effect(() => effect2($store.a[2]));

    expect(effect1).toHaveBeenCalledTimes(1);
    expect(effect1).toHaveBeenLastCalledWith(3);
    expect(effect2).toHaveBeenCalledTimes(1);
    expect(effect2).toHaveBeenLastCalledWith(7);

    $store.a.push(8);
    flush();
    expect(effect1).toHaveBeenCalledTimes(2);
    expect(effect1).toHaveBeenLastCalledWith(4);
    expect(effect2).toHaveBeenCalledTimes(1);

    $store.a.shift();
    flush();
    expect(effect1).toHaveBeenCalledTimes(3);
    expect(effect1).toHaveBeenLastCalledWith(3);
    expect(effect2).toHaveBeenCalledTimes(2);
    expect(effect2).toHaveBeenLastCalledWith(8);
  });

  it("should handle arrays of objects", () => {
    const $store = store([
      { id: 1, value: 10 },
      { id: 2, value: 20 },
    ]);
    const effectFn = jest.fn();

    effect(() => effectFn($store.map((item) => item.value)));

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith([10, 20]);

    $store[0].value = 15;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith([15, 20]);

    $store.push({ id: 3, value: 30 });
    flush();
    expect(effectFn).toHaveBeenCalledTimes(3);
    expect(effectFn).toHaveBeenLastCalledWith([15, 20, 30]);
  });

  it("should handle nested arrays", () => {
    const $store = store([
      [1, 2],
      [3, 4],
    ]);
    const effectFn = jest.fn();

    effect(() =>
      effectFn($store.map((subArr) => subArr.reduce((a, b) => a + b, 0)))
    );

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith([3, 7]);

    $store[0].push(5);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith([8, 7]);

    $store.push([5, 6]);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(3);
    expect(effectFn).toHaveBeenLastCalledWith([8, 7, 11]);
  });

  it("should dispose signal off when property is deleted", () => {
    const disposeFn = jest.spyOn(ReactiveNode.prototype, "dispose");
    const $store = store<{ a?: number }>({ a: 10 });
    const effectFn = jest.fn();

    effect(() => effectFn($store.a));

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(disposeFn).not.toHaveBeenCalled();

    delete $store.a;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(disposeFn).toHaveBeenCalledTimes(1);

    $store.a = 5;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1); //original signal is disposed off
    expect(disposeFn).toHaveBeenCalledTimes(1);
  });

  it("should handle array reassignments", () => {
    const obj = store<any>({ a: [1, 2, 3] });
    const effect1 = jest.fn();
    const effect2 = jest.fn();

    effect(() => {
      effect1(obj.a.length);
    });

    effect(() => {
      effect2(obj.a.map((i: number) => i * 2));
    });

    expect(effect1).toHaveBeenCalledTimes(1);
    expect(effect1).toHaveBeenLastCalledWith(3);
    expect(effect2).toHaveBeenCalledTimes(1);
    expect(effect2).toHaveBeenLastCalledWith([2, 4, 6]);
    expect(signalFn).toHaveBeenCalledTimes(4); // 3 elements + length

    obj.a = [4, 5, 6, 7];
    flush();
    expect(effect1).toHaveBeenCalledTimes(2);
    expect(effect1).toHaveBeenLastCalledWith(4);
    expect(effect2).toHaveBeenCalledTimes(2);
    expect(effect2).toHaveBeenLastCalledWith([8, 10, 12, 14]);
    expect(disposeFn).toHaveBeenCalledTimes(0); // should not dispose previous elements
    expect(signalFn).toHaveBeenCalledTimes(5); // reuse 4 previous signals
  });

  it("should handle updation with different types", () => {
    const obj = store<any>({ a: { b: 10 }, c: [1, 2], d: true });

    const effect1 = jest.fn();
    effect(() => effect1(obj.a.b));

    expect(effect1).toHaveBeenCalledTimes(1);
    expect(effect1).toHaveBeenLastCalledWith(10);

    obj.a = [1, 2];
    flush();
    expect(effect1).toHaveBeenCalledTimes(1);
    expect(storeDisposeFn).toHaveBeenCalledTimes(1); //prev a obj
    expect(disposeFn).toHaveBeenCalledTimes(1); // b prop

    const effect2 = jest.fn();
    effect(() => {
      effect2(obj.c.length);
    });
    expect(effect2).toHaveBeenCalledTimes(1);
    expect(effect2).toHaveBeenLastCalledWith(2);

    obj.c = { x: 1 };
    flush();
    expect(effect2).toHaveBeenCalledTimes(1);
    expect(storeDisposeFn).toHaveBeenCalledTimes(2); //prev c array
    expect(disposeFn).toHaveBeenCalledTimes(2); // 1 from array length + 1 from object

    const effect3 = jest.fn();
    effect(() => effect3(obj.d));
    expect(effect3).toHaveBeenCalledTimes(1);
    expect(effect3).toHaveBeenLastCalledWith(true);

    obj.d = [1, 2];
    flush();
    expect(effect3).toHaveBeenCalledTimes(1);
    expect(disposeFn).toHaveBeenCalledTimes(3);
  });

  it("should handle cyclic references", () => {
    interface CyclicObj {
      a: number;
      b?: CyclicObj;
    }

    const obj = store<CyclicObj>({ a: 1 });
    obj.b = obj;

    const effectFn = jest.fn();

    effect(() => effectFn(obj.a, obj.b?.a));

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith(1, 1);

    obj.a = 2;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith(2, 2);
  });

  it("should get disposed when parent scope is disposed", () => {
    let cleanup: () => void;
    createRoot((dispose) => {
      const obj = store({ a: 100 });
      obj.a;
      cleanup = dispose;
    });
    expect(storeDisposeFn.mock.calls.length).toBe(0);
    expect(disposeFn.mock.calls.length).toBe(0);

    cleanup!();
    expect(storeDisposeFn.mock.calls.length).toBe(1);
    expect(disposeFn.mock.calls.length).toBe(1);
  });

  it("should allow signals as properties", () => {
    const obj = store({ a: signal(0) });
    const effectFn = jest.fn();

    effect(() => {
      effectFn(obj.a);
    });

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith(0);

    obj.a = 100;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith(100);
  });

  it("should allow derived signals as properties and correctly handle their disposal", () => {
    const a = signal(10);
    const obj = store<{ b?: Signal<number> }>({ b: signal(() => a() * 2) });
    const effectFn = jest.fn();

    effect(() => {
      effectFn(obj.b);
    });
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith(20);

    a.set(15);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith(30);

    delete obj.b;
    a.set(5);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith(30);
  });
});

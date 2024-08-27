import { store, effect, flush, StoreNode, signal, Signal } from "../src";
import { createRoot, ReactiveNode } from "../src/core";
import * as signals from "../src/signals";

describe("store", () => {
  let signalSpy: jest.SpyInstance;
  let reactiveDisposeSpy: jest.SpyInstance;
  let storeDisposeSpy: jest.SpyInstance;

  beforeEach(() => {
    signalSpy = jest.spyOn(signals, "signal");
    reactiveDisposeSpy = jest.spyOn(ReactiveNode.prototype, "dispose");
    storeDisposeSpy = jest.spyOn(StoreNode.prototype, "dispose");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should make store properties reactive", () => {
    const obj = store({ a: 100, b: "x" });
    const effect1 = jest.fn();
    const effect2 = jest.fn();

    effect(() => effect1(obj.a));
    effect(() => effect2(obj.b));

    expect(effect1).toHaveBeenCalledTimes(1);
    expect(effect1).toHaveBeenLastCalledWith(100);
    expect(effect2).toHaveBeenCalledTimes(1);
    expect(effect2).toHaveBeenLastCalledWith("x");

    obj.a = 120;
    flush();
    expect(effect1).toHaveBeenCalledTimes(2);
    expect(effect1).toHaveBeenLastCalledWith(120);
    expect(effect2).toHaveBeenCalledTimes(1);

    obj.b = "y";
    flush();
    expect(effect1).toHaveBeenCalledTimes(2);
    expect(effect2).toHaveBeenCalledTimes(2);
    expect(effect2).toHaveBeenLastCalledWith("y");
  });

  it("should not make the store object itself trackable", () => {
    const obj = store({ a: 100 });
    const effectFn = jest.fn();

    effect(() => effectFn(obj));

    expect(effectFn).toHaveBeenCalledTimes(1);

    obj.a = 10;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1);
  });

  it("should handle nested objects reactively", () => {
    const obj = store({ a: { b: 100 }, c: true });
    const effectFn = jest.fn();

    effect(() => effectFn(obj.a.b));

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith(100);

    obj.a.b = 20;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith(20);

    obj.c = false;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
  });

  it("should handle complete re-assignment of nested objects", () => {
    const obj = store({ a: { b: 100 } });
    const effectFn = jest.fn();

    effect(() => effectFn(obj.a.b));

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith(100);

    obj.a = { b: 20 };
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith(20);
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
    expect(signalSpy).toHaveBeenCalledTimes(4); // 3 elements + length

    obj.a = [4, 5, 6, 7];
    flush();
    expect(effect1).toHaveBeenCalledTimes(2);
    expect(effect1).toHaveBeenLastCalledWith(4);
    expect(effect2).toHaveBeenCalledTimes(2);
    expect(effect2).toHaveBeenLastCalledWith([8, 10, 12, 14]);
    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(0); // should not dispose previous elements
    expect(signalSpy).toHaveBeenCalledTimes(5); // reuse 4 previous signals
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
    expect(storeDisposeSpy).toHaveBeenCalledTimes(1); //prev a obj
    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(1); // b prop

    const effect2 = jest.fn();
    effect(() => {
      effect2(obj.c.length);
    });
    expect(effect2).toHaveBeenCalledTimes(1);
    expect(effect2).toHaveBeenLastCalledWith(2);

    obj.c = { x: 1 };
    flush();
    expect(effect2).toHaveBeenCalledTimes(1);
    expect(storeDisposeSpy).toHaveBeenCalledTimes(2); //prev c array
    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(2); // 1 from array length + 1 from object

    const effect3 = jest.fn();
    effect(() => effect3(obj.d));
    expect(effect3).toHaveBeenCalledTimes(1);
    expect(effect3).toHaveBeenLastCalledWith(true);

    obj.d = [1, 2];
    flush();
    expect(effect3).toHaveBeenCalledTimes(1);
    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(3);
  });

  it("should lazily create signals", () => {
    const obj = store({ a: { b: 10, c: 20 }, d: 30 });
    expect(signalSpy).not.toHaveBeenCalled();

    obj.a.b;
    expect(signalSpy).toHaveBeenCalledTimes(1);

    obj.d;
    expect(signalSpy).toHaveBeenCalledTimes(2);
  });

  it("should not create signals for methods", () => {
    const obj = store({
      a: 10,
      method: () => console.log("Hello"),
    });
    obj.a;
    obj.method;
    expect(signalSpy).toHaveBeenCalledTimes(1);
  });

  it("should dispose signal if new value is not mergeable", () => {
    const obj = store<{ a?: { b: number; c: boolean; d: string } }>({
      a: { b: 10, c: true, d: "x" },
    });
    const effectFn = jest.fn();
    effect(() => {
      obj.a?.b;
      obj.a?.c;
      effectFn();
    });

    obj.a = undefined;
    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenCalledTimes(1);

    obj.a = { b: 15, c: true, d: "y" };
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1);
  });

  it("should dispose deeply nested objects", () => {
    type Obj = {
      a?: {
        b: {
          d: { e: number };
          f: boolean;
        };
        c: number;
      };
    };
    const obj = store<Obj>({ a: { b: { d: { e: 10 }, f: true }, c: 20 } });

    obj.a?.b.d.e;
    obj.a?.b.f;
    obj.a?.c;

    obj.a = undefined;

    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(3);
    expect(storeDisposeSpy).toHaveBeenCalledTimes(3);
  });

  it("should dispose signals when properties are deleted", () => {
    const obj = store<{ a?: number; b: number }>({ a: 1, b: 2 });

    obj.a;
    obj.b;

    delete obj.a;
    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(1);
  });

  it("should handle basic array operations", () => {
    const arr = store([1, 2, 3]);
    const effectFn = jest.fn();

    effect(() => effectFn(arr.length, arr[0]));

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith(3, 1);

    arr.push(4);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith(4, 1);

    arr[0] = 10;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(3);
    expect(effectFn).toHaveBeenLastCalledWith(4, 10);
  });

  it("should handle array methods correctly", () => {
    const arr = store([1, 2, 3, 4, 5]);
    const mapFn = jest.fn();
    const filterFn = jest.fn();
    const everyFn = jest.fn();

    effect(() => mapFn(arr.map((x) => x * 2)));
    effect(() => filterFn(arr.filter((x) => x % 2 === 0)));
    effect(() => everyFn(arr.every((x) => x > 0)));

    expect(mapFn).toHaveBeenCalledTimes(1);
    expect(mapFn).toHaveBeenLastCalledWith([2, 4, 6, 8, 10]);
    expect(filterFn).toHaveBeenCalledTimes(1);
    expect(filterFn).toHaveBeenLastCalledWith([2, 4]);
    expect(everyFn).toHaveBeenCalledTimes(1);
    expect(everyFn).toHaveBeenLastCalledWith(true);

    arr.push(6);
    flush();
    expect(mapFn).toHaveBeenCalledTimes(2);
    expect(mapFn).toHaveBeenLastCalledWith([2, 4, 6, 8, 10, 12]);
    expect(filterFn).toHaveBeenCalledTimes(2);
    expect(filterFn).toHaveBeenLastCalledWith([2, 4, 6]);
    expect(everyFn).toHaveBeenCalledTimes(2);
    expect(everyFn).toHaveBeenLastCalledWith(true);

    arr[0] = -1;
    flush();
    expect(mapFn).toHaveBeenCalledTimes(3);
    expect(mapFn).toHaveBeenLastCalledWith([-2, 4, 6, 8, 10, 12]);
    expect(filterFn).toHaveBeenCalledTimes(3);
    expect(filterFn).toHaveBeenLastCalledWith([2, 4, 6]);
    expect(everyFn).toHaveBeenCalledTimes(3);
    expect(everyFn).toHaveBeenLastCalledWith(false);
  });

  it("should handle length property changes", () => {
    const arr = store([1, 2, 3, 4, 5]);
    const effectFn = jest.fn();

    effect(() => effectFn(arr.length));

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith(5);

    arr.push(6);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith(6);

    arr.length = 3;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(3);
    expect(effectFn).toHaveBeenLastCalledWith(3);
  });

  it("should handle arrays of objects", () => {
    const arr = store([
      { id: 1, value: 10 },
      { id: 2, value: 20 },
    ]);
    const effectFn = jest.fn();

    effect(() => effectFn(arr.map((item) => item.value)));

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith([10, 20]);

    arr[0].value = 15;
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith([15, 20]);

    arr.push({ id: 3, value: 30 });
    flush();
    expect(effectFn).toHaveBeenCalledTimes(3);
    expect(effectFn).toHaveBeenLastCalledWith([15, 20, 30]);
  });

  it("should handle disposal of array elements", () => {
    const arr = store([{ id: 1 }, { id: 2 }, { id: 3 }]);

    arr[0].id;
    arr[1].id;
    arr[2].id;

    expect(reactiveDisposeSpy).not.toHaveBeenCalled();

    arr.pop();
    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(1);

    arr.shift();
    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(2);

    arr.length = 0;
    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(3);

    reactiveDisposeSpy.mockClear();

    const arr2 = store([1, 2, 3, 4, 5, 6]);

    for (let i = 0; i < arr2.length; i++) arr2[i];

    expect(reactiveDisposeSpy).not.toHaveBeenCalled();

    arr2.pop();
    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(1);

    arr2.shift();
    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(2);

    arr2.length = 2;
    expect(reactiveDisposeSpy).toHaveBeenCalledTimes(4);
  });

  it("should handle nested arrays", () => {
    const arr = store([
      [1, 2],
      [3, 4],
    ]);
    const effectFn = jest.fn();

    effect(() =>
      effectFn(arr.map((subArr) => subArr.reduce((a, b) => a + b, 0)))
    );

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenLastCalledWith([3, 7]);

    arr[0].push(5);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenLastCalledWith([8, 7]);

    arr.push([5, 6]);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(3);
    expect(effectFn).toHaveBeenLastCalledWith([8, 7, 11]);
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
    let disposeFn: () => void;
    createRoot((dispose) => {
      const obj = store({ a: 100 });
      obj.a;
      disposeFn = dispose;
    });
    expect(storeDisposeSpy.mock.calls.length).toBe(0);
    expect(reactiveDisposeSpy.mock.calls.length).toBe(0);

    disposeFn!();
    expect(storeDisposeSpy.mock.calls.length).toBe(1);
    expect(storeDisposeSpy.mock.calls.length).toBe(1);
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

import { effect, flush, signal, unTrack } from "../src";

describe("unTrack", () => {
  it("should access signal values without creating dependencies", () => {
    const a = signal(1);
    const b = signal(5);
    const effectFn = jest.fn();
    let result: number;

    effect(() => {
      result = unTrack(() => {
        return a() * b();
      });
      effectFn();
    });

    expect(result!).toBe(5);

    expect(effectFn).toHaveBeenCalledTimes(1);

    a.set(2);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1);

    b.set(10);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1);
  });

  it("should allow mixing tracked and untracked access", () => {
    const a = signal(1);
    const b = signal(5);
    const effectFn = jest.fn();
    let lastResult = 0;

    effect(() => {
      const result = a() * unTrack(() => b());
      lastResult = result;
      effectFn();
    });

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(lastResult).toBe(5);

    a.set(2);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(lastResult).toBe(10);

    b.set(10);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(lastResult).toBe(10);
  });

  it("should work with nested unTrack calls", () => {
    const a = signal(1);
    const b = signal(5);
    const c = signal(10);
    const effectFn = jest.fn();
    let lastResult = 0;

    effect(() => {
      const result = unTrack(() => {
        return a() * unTrack(() => b()) + c();
      });
      lastResult = result;
      effectFn();
    });

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(lastResult).toBe(15);

    a.set(2);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(lastResult).toBe(15);

    b.set(10);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(lastResult).toBe(15);

    c.set(20);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(lastResult).toBe(15);
  });

  it("should not interfere with tracking outside of unTrack", () => {
    const a = signal(1);
    const b = signal(5);
    const effectFn = jest.fn();
    let lastResult = 0;

    effect(() => {
      const untracked = unTrack(() => b());
      const result = a() + untracked;
      lastResult = result;
      effectFn();
    });

    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(lastResult).toBe(6);

    a.set(2);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(lastResult).toBe(7);

    b.set(10);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(lastResult).toBe(7);
  });
});

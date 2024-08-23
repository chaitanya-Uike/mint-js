import { createRoot, effect, flush, onCleanup, signal, Signal } from "../src";

describe("createRoot", () => {
  it("should dispose child reactives", () => {
    let a: Signal<number>;
    let b: Signal<number>;

    const computeFn = jest.fn();
    const effectFn = jest.fn();

    createRoot((dispose) => {
      a = signal(10);
      b = signal(() => {
        computeFn();
        return a() * 2;
      });

      effect(() => {
        a();
        effectFn();
      });

      b();
      dispose();
    });

    expect(b!()).toBe(20);
    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenCalledTimes(1);

    a!.set(20);
    expect(b!()).toBe(20);
    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenCalledTimes(1);
  });

  it("should return result", () => {
    const result = createRoot(() => 10);
    expect(result).toBe(10);
  });

  it("should dispose nested roots", () => {
    const a = signal(0);
    const effectFn = jest.fn();
    const cleanupFn = jest.fn();
    createRoot((dispose) => {
      createRoot(() => {
        effect(() => {
          a();
          effectFn();
          onCleanup(cleanupFn);
        });
      });
      dispose();
    });
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);

    a.set(1);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });
  it("should allow manual disposal of roots", () => {
    let dispose: () => void;
    const effectFn = jest.fn();
    const a = signal(0);

    createRoot((d) => {
      dispose = d;
      effect(() => {
        a();
        effectFn();
      });
    });

    expect(effectFn).toHaveBeenCalledTimes(1);

    a.set(1);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);

    dispose!();

    a.set(2);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
  });
});

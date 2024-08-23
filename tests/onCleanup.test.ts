import { effect, signal, onCleanup, flush, createRoot } from "../src";

describe("onCleanup", () => {
  it("should run cleanup function when effect is re-run", () => {
    const count = signal(0);
    const cleanupFn = jest.fn();

    effect(() => {
      count();
      onCleanup(cleanupFn);
    });

    expect(cleanupFn).not.toHaveBeenCalled();

    count.set(1);
    flush();

    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it("should allow multiple cleanup functions", () => {
    const count = signal(0);
    const cleanupFn1 = jest.fn();
    const cleanupFn2 = jest.fn();

    effect(() => {
      count();
      onCleanup(cleanupFn1);
      onCleanup(cleanupFn2);
    });

    count.set(1);
    flush();

    expect(cleanupFn1).toHaveBeenCalledTimes(1);
    expect(cleanupFn2).toHaveBeenCalledTimes(1);
  });

  it("should run cleanup functions in reverse order of registration", () => {
    const count = signal(0);
    const order: number[] = [];

    effect(() => {
      count();
      onCleanup(() => order.push(1));
      onCleanup(() => order.push(2));
      onCleanup(() => order.push(3));
    });

    count.set(1);
    flush();

    expect(order).toEqual([3, 2, 1]);
  });

  it("should run cleanup function when effect is disposed", () => {
    const cleanupFn = jest.fn();
    let dispose: () => void;

    createRoot((d) => {
      effect(() => {
        dispose = d;
        onCleanup(cleanupFn);
      });
    });

    expect(cleanupFn).not.toHaveBeenCalled();

    dispose!();

    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it("should handle nested effects correctly", () => {
    const outer = signal(0);
    const inner = signal(0);
    const outerCleanup = jest.fn();
    const innerCleanup = jest.fn();

    effect(() => {
      outer();
      onCleanup(outerCleanup);

      effect(() => {
        inner();
        onCleanup(innerCleanup);
      });
    });

    inner.set(1);
    flush();

    expect(outerCleanup).not.toHaveBeenCalled();
    expect(innerCleanup).toHaveBeenCalledTimes(1);

    outer.set(1);
    flush();

    expect(outerCleanup).toHaveBeenCalledTimes(1);
    expect(innerCleanup).toHaveBeenCalledTimes(2);
  });
});

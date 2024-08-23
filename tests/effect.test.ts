import { effect, flush, onCleanup, signal } from "../src";

afterEach(flush);

describe("effect", () => {
  it("should run effect", () => {
    const a = signal(0);
    const effectFn = jest.fn(() => a());
    effect(effectFn);
    expect(effectFn).toHaveBeenCalledTimes(1);
    a.set(1);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
  });

  it("should run effect on dependency change", () => {
    const a = signal(2);
    const b = signal(4);
    const c = signal(() => a() * b());
    const effectFn = jest.fn(() => c());
    effect(effectFn);
    expect(effectFn).toHaveBeenCalledTimes(1);
    a.set(5);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    b.set(8);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(3);
  });

  it("should handle nested effect", () => {
    const a = signal(0);
    const b = signal(0);
    const outerEffect = jest.fn();
    const innerEffect = jest.fn();
    const innerDispose = jest.fn();
    effect(() => {
      a();
      outerEffect();
      effect(() => {
        b();
        innerEffect();
        onCleanup(innerDispose);
      });
    });
    expect(outerEffect).toHaveBeenCalledTimes(1);
    expect(innerEffect).toHaveBeenCalledTimes(1);
    expect(innerDispose).not.toHaveBeenCalled();
    b.set(1);
    flush();
    expect(outerEffect).toHaveBeenCalledTimes(1);
    expect(innerEffect).toHaveBeenCalledTimes(2);
    expect(innerDispose).toHaveBeenCalledTimes(1);
    b.set(2);
    flush();
    expect(outerEffect).toHaveBeenCalledTimes(1);
    expect(innerEffect).toHaveBeenCalledTimes(3);
    expect(innerDispose).toHaveBeenCalledTimes(2);
    innerEffect.mockReset();
    innerDispose.mockReset();
    a.set(1);
    flush();
    expect(outerEffect).toHaveBeenCalledTimes(2);
    expect(innerEffect).toHaveBeenCalledTimes(1);
    expect(innerDispose).toHaveBeenCalledTimes(1);
  });

  it("should run the returned cleanup function on rerun", () => {
    const a = signal(0);
    const cleanup = jest.fn();
    effect(() => {
      a();
      return cleanup;
    });
    expect(cleanup).not.toHaveBeenCalled();
    for (let i = 1; i <= 3; i++) {
      a.set(i);
      flush();
      expect(cleanup).toHaveBeenCalledTimes(i);
    }
  });

  it("should run all cleanup functions on rerun", () => {
    const a = signal(0);
    const cleanup1 = jest.fn();
    const cleanup2 = jest.fn();
    const cleanup3 = jest.fn();
    effect(() => {
      a();
      onCleanup(cleanup1);
      onCleanup(cleanup2);
      onCleanup(cleanup3);
    });
    expect(cleanup1).not.toHaveBeenCalled();
    expect(cleanup2).not.toHaveBeenCalled();
    expect(cleanup3).not.toHaveBeenCalled();
    for (let i = 1; i <= 3; i++) {
      a.set(i);
      flush();
      expect(cleanup1).toHaveBeenCalledTimes(i);
      expect(cleanup2).toHaveBeenCalledTimes(i);
      expect(cleanup3).toHaveBeenCalledTimes(i);
    }
  });

  it("should handle conditional tracking", () => {
    const a = signal(0);
    const b = signal(0);
    const cond = signal(true);
    const c = signal(() => (cond() ? a() : b()));
    const effectFn = jest.fn();
    effect(() => {
      c();
      effectFn();
    });
    expect(effectFn).toHaveBeenCalledTimes(1);
    b.set(1);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(1);
    a.set(1);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    cond.set(false);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(2);
    b.set(2);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(3);
    a.set(2);
    flush();
    expect(effectFn).toHaveBeenCalledTimes(3);
  });

  it("should handle disposal of nested conditional effect", () => {
    const a = signal(true);
    const effect1 = jest.fn();
    const effect2 = jest.fn();
    const dispose1 = jest.fn();
    const dispose2 = jest.fn();
    effect(() => {
      if (a()) {
        effect(() => {
          effect1();
          onCleanup(dispose1);
        });
      } else {
        effect(() => {
          effect2();
          onCleanup(dispose2);
        });
      }
    });
    expect(effect1).toHaveBeenCalledTimes(1);
    expect(effect2).not.toHaveBeenCalled();
    expect(dispose1).not.toHaveBeenCalled();
    expect(dispose2).not.toHaveBeenCalled();
    a.set(false);
    flush();
    expect(effect1).toHaveBeenCalledTimes(1);
    expect(effect2).toHaveBeenCalledTimes(1);
    expect(dispose1).toHaveBeenCalledTimes(1);
    expect(dispose2).not.toHaveBeenCalled();
    a.set(true);
    flush();
    expect(effect1).toHaveBeenCalledTimes(2);
    expect(effect2).toHaveBeenCalledTimes(1);
    expect(dispose1).toHaveBeenCalledTimes(1);
    expect(dispose2).toHaveBeenCalledTimes(1);
  });

  it("should handle looped effects", () => {
    let values: number[] = [],
      loop = 2;
    const value = signal(0);
    effect(() => {
      values.push(value());
      for (let i = 0; i < loop; i++) {
        effect(() => values.push(value() + i));
      }
    });
    flush();
    expect(values).toHaveLength(3);
    expect(values.join(",")).toBe("0,0,1");
    loop = 1;
    values = [];
    value.set(1);
    flush();
    expect(values).toHaveLength(2);
    expect(values.join(",")).toBe("1,1");
    values = [];
    value.set(2);
    flush();
    expect(values).toHaveLength(2);
    expect(values.join(",")).toBe("2,2");
  });

  it("runs parent effects before child effects", () => {
    const a = signal(0, "Signal A");
    const b = signal(() => a(), "Signal B");
    let calls = 0;
    effect(() => {
      effect(() => {
        void a();
        calls++;
      }, "inner");
      b();
    }, "outer");
    a.set(1);
    flush();
    expect(calls).toBe(2);
  });
});

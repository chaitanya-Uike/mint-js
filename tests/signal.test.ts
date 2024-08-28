import { signal } from "../src";

describe("signal", () => {
  describe("basic functionality", () => {
    it("should create a signal with an initial value", () => {
      const a = signal(0);
      expect(a()).toBe(0);
    });

    it("should update the signal value using set", () => {
      const a = signal(0);
      a.set(5);
      expect(a()).toBe(5);
    });

    it("should update the signal value using a callback", () => {
      const a = signal(10);
      a.set((prevVal: number) => prevVal + 5);
      expect(a()).toBe(15);
    });
  });

  describe("derived signals", () => {
    it("should create a derived signal", () => {
      const a = signal(1);
      const b = signal(() => a() * 2);
      expect(b()).toBe(2);
    });

    it("should not update when same value is passed to set", () => {
      const a = signal(1);
      const computeFn = jest.fn(() => a() * 2);

      const b = signal(computeFn);
      b();
      expect(computeFn).toHaveBeenCalledTimes(1);

      a.set(1);
      b();
    });

    it("should update derived signal when dependency changes", () => {
      const a = signal(1);
      const b = signal(() => a() * 2);
      a.set(3);
      expect(b()).toBe(6);
    });

    it("should update derived signal when dependency is updated using a callback", () => {
      const a = signal(1);
      const b = signal(() => a() * 2);
      a.set((prevVal) => prevVal + 4);
      expect(b()).toBe(10);
    });

    it("should handle multiple levels of derived signals", () => {
      const a = signal(1);
      const b = signal(() => a() * 2);
      const c = signal(() => b() + 3);
      expect(c()).toBe(5);
      a.set(3);
      expect(c()).toBe(9);
    });

    it("should track new sources when updating using callback", () => {
      const a = signal(5);
      const b = signal(20);

      // updating a wont affect b
      a.set(10);
      expect(b()).toBe(20);

      // b should now start tracking a
      b.set(() => a() * 3);
      expect(b()).toBe(30);

      // updating a now should update b
      a.set(20);
      expect(b()).toBe(60);
    });

    it("should only compute when needed", () => {
      const compute = jest.fn();

      const a = signal(4);
      const b = signal(2);

      const c = signal(() => compute(a() * b()));

      expect(compute).not.toHaveBeenCalled();

      c();
      expect(compute).toHaveBeenCalledTimes(1);
      expect(compute).toHaveBeenCalledWith(8);

      c();
      expect(compute).toHaveBeenCalledTimes(1);

      a.set(5);
      expect(compute).toHaveBeenCalledTimes(1);

      c();
      expect(compute).toHaveBeenCalledTimes(2);
      expect(compute).toHaveBeenCalledWith(10);

      b.set(20);
      c();
      expect(compute).toHaveBeenCalledTimes(3);
      expect(compute).toHaveBeenCalledWith(100);

      c();
      expect(compute).toHaveBeenCalledTimes(3);
    });

    it("should update dependencies during execution", () => {
      const a = signal(true);
      const b = signal(10);
      let computeCount = 0;

      const c = signal(() => {
        computeCount++;
        if (a()) return 5;
        return b();
      });

      expect(c()).toBe(5);
      expect(computeCount).toBe(1);

      b.set(15);
      expect(c()).toBe(5);
      expect(computeCount).toBe(1);

      a.set(false);
      expect(c()).toBe(15);
      expect(computeCount).toBe(2);

      b.set(1);
      expect(c()).toBe(1);
      expect(computeCount).toBe(3);

      a.set(true);
      expect(c()).toBe(5);
      expect(computeCount).toBe(4);

      b.set(9);
      expect(c()).toBe(5);
      expect(computeCount).toBe(4);
    });
  });

  describe("diamond problem", () => {
    it("should handle the diamond problem correctly", () => {
      /*
           a
          / \
         b   c
          \ /
           d
      */
      const a = signal(1);
      const b = signal(() => a() * 2);
      const c = signal(() => a() + 1);
      const d = signal(() => b() + c());

      expect(d()).toBe(4);

      a.set(2);
      expect(d()).toBe(7);
    });

    it("should update diamond-dependent signal only once per change", () => {
      /*
           a
          / \
         b   c
          \ /
           d
           |
           e
      */
      const a = signal(1);
      const b = signal(() => a() * 2);
      const c = signal(() => a() + 1);
      const d = signal(() => b() + c());

      let computeCount = 0;
      const e = signal(() => {
        computeCount++;
        return d() * 2;
      });

      expect(e()).toBe(8);
      expect(computeCount).toBe(1);

      a.set(2);
      expect(e()).toBe(14);
      expect(computeCount).toBe(2);
    });

    it("should handle complex diamond dependencies", () => {
      /*
           a
          / \
         b   c
        /     \
       d       e
        \     /
         \  /
          f
      */
      const a = signal(1);
      const b = signal(() => a() * 2);
      const c = signal(() => a() + 3);
      const d = signal(() => b() * 3);
      const e = signal(() => c() - 1);
      const f = signal(() => d() + e());

      expect(f()).toBe(9);

      a.set(2);
      expect(f()).toBe(16);
    });
  });
});

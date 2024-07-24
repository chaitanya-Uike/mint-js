import { signal, Signal, isSignal, createEffect } from "./signals";

type Unwrap<T> = T extends Signal<infer U> ? U : T;

export type Store<T extends object> = {
  [K in keyof T]: T[K] extends object ? Store<T[K]> : Signal<T[K]>;
};

type WritableStore<T extends object> = {
  [K in keyof T]: T[K] extends object ? WritableStore<T[K]> : Unwrap<T[K]>;
};

function createStore<T extends object>(initialState: T): WritableStore<T> {
  const store: Partial<Store<T>> = {};
  const signalCache = new WeakMap<object, WritableStore<any>>();

  function wrapInProxy(
    target: object,
    parentSignal?: Signal<any>,
    parentProp?: string
  ): WritableStore<any> {
    if (signalCache.has(target)) {
      return signalCache.get(target)!;
    }

    const objectSignal =
      parentSignal && parentProp
        ? createComputedSignal(() => parentSignal()[parentProp])
        : signal(target);

    const handler: ProxyHandler<object> = {
      get(_, prop: string | symbol) {
        if (typeof prop === "symbol" || prop.startsWith("__")) {
          return Reflect.get(target, prop);
        }

        const currentTarget = objectSignal();

        if (!(prop in store)) {
          const value = Reflect.get(currentTarget, prop);
          if (typeof value === "object" && value !== null) {
            store[prop as keyof T] = wrapInProxy(
              value,
              objectSignal,
              prop as string
            ) as any;
          } else {
            store[prop as keyof T] = createComputedSignal(
              () => objectSignal()[prop as keyof typeof currentTarget]
            ) as any;
          }
        }

        const signalOrProxy = store[prop as keyof T];
        return isSignal(signalOrProxy) ? signalOrProxy() : signalOrProxy;
      },

      set(_, prop: string | symbol, value: any) {
        if (typeof prop === "symbol" || prop.startsWith("__")) {
          return Reflect.set(target, prop, value);
        }

        const currentTarget = objectSignal();
        let newTarget = { ...currentTarget };

        if (typeof value === "object" && value !== null) {
          newTarget[prop as keyof typeof newTarget] = { ...value };
        } else {
          newTarget[prop as keyof typeof newTarget] = value;
        }

        objectSignal.set(newTarget);
        return true;
      },

      deleteProperty(_, prop: string | symbol) {
        if (typeof prop === "symbol" || prop.startsWith("__")) {
          return Reflect.deleteProperty(target, prop);
        }

        const currentTarget = objectSignal();
        const newTarget = { ...currentTarget };
        delete newTarget[prop as keyof typeof newTarget];
        delete store[prop as keyof T];
        objectSignal.set(newTarget);
        return true;
      },
    };

    const proxiedStore = new Proxy({}, handler) as WritableStore<any>;
    signalCache.set(target, proxiedStore);
    return proxiedStore;
  }

  function createComputedSignal<U>(getter: () => U): Signal<U> {
    let cachedValue: U;
    const derivedSignal = signal(getter());
    createEffect(() => {
      const newValue = getter();
      if (newValue !== cachedValue) {
        cachedValue = newValue;
        derivedSignal.set(newValue);
      }
    });
    return derivedSignal;
  }

  return wrapInProxy(initialState) as WritableStore<T>;
}

export { createStore };

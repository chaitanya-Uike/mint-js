import { Reactive, onCleanup } from "./core";

const SIGNAL = Symbol("signal");

export interface Signal<T> {
  (): T;
  set(value: T | ((prevVal: T) => void)): void;
  [SIGNAL]: boolean;
}

export function signal<T>(initValue: T | (() => T)): Signal<T> {
  const node = new Reactive(initValue);

  const signalFunction = function (): T {
    return node.get();
  } as Signal<T>;

  signalFunction.set = node.set.bind(node);
  signalFunction[SIGNAL] = true;

  return signalFunction;
}

export function isSignal(value: any): value is Signal<any> {
  return typeof value === "function" && value[SIGNAL] === true;
}

export function createEffect(fn: () => any | (() => void)): void {
  new Reactive(() => {
    const cleanup = fn();
    if (typeof cleanup === "function") {
      onCleanup(cleanup);
    }
  }, true);
}

export function createMemo<T>(fn: () => T): () => T {
  const node = new Reactive(fn);
  return node.get.bind(node);
}

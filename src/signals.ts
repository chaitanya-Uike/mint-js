import { Reactive, effect, onCleanup } from "./core";
import { DISPOSE } from "./constants";

const SIGNAL = Symbol("signal");

export interface Signal<T = any> {
  (): T;
  set(value: T | ((prevVal: T) => void)): void;
  [SIGNAL]: boolean;
  [DISPOSE]: () => void;
}

export function signal<T>(initValue: T | (() => T)): Signal<T> {
  const node = new Reactive(initValue);
  const signalFunction = function (): T {
    return node.get();
  } as Signal<T>;
  signalFunction.set = node.set.bind(node);
  signalFunction[SIGNAL] = true;
  signalFunction[DISPOSE] = node.dispose.bind(node);

  return signalFunction;
}

export function isSignal(value: any): value is Signal<any> {
  return typeof value === "function" && value[SIGNAL] === true;
}

export function createEffect(fn: () => any | (() => void)): void {
  effect(() => {
    const cleanup = fn();
    if (typeof cleanup === "function") {
      onCleanup(cleanup);
    }
  });
}

export function createMemo<T>(fn: () => T): () => T {
  const node = new Reactive(fn);
  return node.get.bind(node);
}

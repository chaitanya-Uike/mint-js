import { ReactiveNode, Root, createReactive, effect, onCleanup } from "./core";
import { DISPOSE, NODE } from "./constants";

const SIGNAL = Symbol("signal");

export interface Signal<T = any> {
  (): T;
  set(value: T | ((prevVal: T) => void)): void;
  [SIGNAL]: boolean;
  [DISPOSE]: () => void;
  [NODE]: ReactiveNode<T>;
}

export function signal<T>(initValue: T | (() => T)): Signal<T> {
  return createSignalWithinScope(initValue);
}

export function isSignal(value: any): value is Signal<any> {
  return typeof value === "function" && value[SIGNAL] === true;
}

export function memo<T>(fn: () => T): () => T {
  const node = new ReactiveNode(fn);
  return node.get.bind(node);
}

export function createSignalWithinScope<T>(
  initValue: T | (() => T),
  scope?: Root
) {
  const node = createReactive(initValue, false, scope);
  const signalFunction = function (): T {
    return node.get();
  } as Signal<T>;
  signalFunction.set = node.set.bind(node);
  signalFunction[SIGNAL] = true;
  signalFunction[DISPOSE] = node.dispose.bind(node);
  signalFunction[NODE] = node;

  return signalFunction;
}

import { ReactiveNode, ScopeNode, createReactive } from "./core";
import { NODE } from "./constants";

const SIGNAL = Symbol("signal");

export interface Signal<T = any> {
  (): T;
  set(value: T | ((prevVal: T) => void)): void;
  [SIGNAL]: boolean;
  [NODE]: ReactiveNode<T>;
}

export function signal<T>(initValue: T | (() => T), label?: string): Signal<T> {
  return createSignalWithinScope(initValue, undefined, label);
}

export function isSignal(value: any): value is Signal {
  return typeof value === "function" && value[SIGNAL] === true;
}

export function memo<T>(fn: () => T): () => T {
  const node = new ReactiveNode(fn);
  return node.get.bind(node);
}

export function createSignalWithinScope<T>(
  initValue: T | (() => T),
  scope?: ScopeNode,
  label?: string
) {
  const node = createReactive(initValue, false, scope, label);
  const signalFunction = function (): T {
    return node.get();
  } as Signal<T>;
  signalFunction.set = node.set.bind(node);
  signalFunction[SIGNAL] = true;
  signalFunction[NODE] = node;

  return signalFunction;
}

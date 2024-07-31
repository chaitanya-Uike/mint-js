import { ReactiveNode, createReactive, effect, onCleanup } from "./core";
import { DISPOSE, NODE } from "./constants";
const SIGNAL = Symbol("signal");
export function signal(initValue) {
    return createSignalWithinScope(initValue);
}
export function isSignal(value) {
    return typeof value === "function" && value[SIGNAL] === true;
}
export function createEffect(fn) {
    effect(() => {
        const cleanup = fn();
        if (typeof cleanup === "function") {
            onCleanup(cleanup);
        }
    });
}
export function createMemo(fn) {
    const node = new ReactiveNode(fn);
    return node.get.bind(node);
}
export function createSignalWithinScope(initValue, scope) {
    const node = createReactive(initValue, false, scope);
    const signalFunction = function () {
        return node.get();
    };
    signalFunction.set = node.set.bind(node);
    signalFunction[SIGNAL] = true;
    signalFunction[DISPOSE] = node.dispose.bind(node);
    signalFunction[NODE] = node;
    return signalFunction;
}

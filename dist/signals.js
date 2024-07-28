import { Reactive, effect, onCleanup } from "./core";
import { $$DISPOSE_SIGNAL } from "./constants";
const SIGNAL = Symbol("signal");
export function signal(initValue) {
    const node = new Reactive(initValue);
    const signalFunction = function () {
        return node.get();
    };
    signalFunction.set = node.set.bind(node);
    signalFunction[SIGNAL] = true;
    signalFunction[$$DISPOSE_SIGNAL] = node.dispose.bind(node);
    return signalFunction;
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
    const node = new Reactive(fn);
    return node.get.bind(node);
}

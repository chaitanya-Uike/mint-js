import { Reactive, onCleanup } from "./core";
const SIGNAL = Symbol("signal");
export function signal(initValue) {
    const node = new Reactive(initValue);
    const signalFunction = function () {
        return node.get();
    };
    signalFunction.set = node.set.bind(node);
    signalFunction[SIGNAL] = true;
    return signalFunction;
}
export function isSignal(value) {
    return typeof value === "function" && value[SIGNAL] === true;
}
export function createEffect(fn) {
    new Reactive(() => {
        const cleanup = fn();
        if (typeof cleanup === "function") {
            onCleanup(cleanup);
        }
    }, true);
}
export function createMemo(fn) {
    const node = new Reactive(fn);
    return node.get.bind(node);
}

import { ReactiveNode, createReactive } from "./core";
import { DISPOSE, NODE } from "./constants";
const SIGNAL = Symbol("signal");
export function signal(initValue, label) {
    return createSignalWithinScope(initValue, undefined, label);
}
export function isSignal(value) {
    return typeof value === "function" && value[SIGNAL] === true;
}
export function memo(fn) {
    const node = new ReactiveNode(fn);
    return node.get.bind(node);
}
export function createSignalWithinScope(initValue, scope, label) {
    const node = createReactive(initValue, false, scope, label);
    const signalFunction = function () {
        return node.get();
    };
    signalFunction.set = node.set.bind(node);
    signalFunction[SIGNAL] = true;
    signalFunction[DISPOSE] = node.dispose.bind(node);
    signalFunction[NODE] = node;
    return signalFunction;
}

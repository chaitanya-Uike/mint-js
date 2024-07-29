import { validTags } from "./constants";
import { effect, createRoot, unTrack, onCleanup } from "./core";
import { isSignal } from "./signals";
import { isFunction } from "./utils";
const getProto = Object.getPrototypeOf;
export const createElement = (name, ...args) => {
    const [props, ...children] = args[0] && Object.prototype.toString.call(args[0]) === "[object Object]"
        ? args
        : [{}, ...args];
    if (!isHTMLTagName(name))
        throw new Error(`invalid node type ${name}`);
    const element = document.createElement(name);
    handleProps(element, props);
    appendChildren(element, children);
    return element;
};
function appendChildren(parent, children) {
    let start = null;
    let end = null;
    for (const child of children) {
        const [childStart, childEnd] = resolveChild(parent, child, null, null);
        if (!start)
            start = childStart;
        end = childEnd;
    }
    return [start, end];
}
function handleSignalChild(element, signal, currStart, currEnd) {
    let markers = [currStart, currEnd];
    effect(() => {
        const value = signal();
        markers = resolveChild(element, value, markers[0], markers[1]);
    });
    return markers;
}
function handleFunctionChild(element, func, currStart, currEnd) {
    let markers = [currStart, currEnd];
    effect(() => {
        const childValue = createRoot((dispose) => {
            onCleanup(dispose);
            return func();
        });
        markers = resolveChild(element, childValue, markers[0], markers[1]);
    });
    return markers;
}
function remove(element, start, end) {
    if (!start && !end)
        return;
    const parent = end?.parentNode ?? element;
    let current = start ?? end;
    const stopNode = end ? end.nextSibling : null;
    while (current && current !== stopNode) {
        const next = current.nextSibling;
        console.log("removed", current);
        parent.removeChild(current);
        current = next;
    }
}
function resolveChild(element, child, currStart, currEnd) {
    const nextSibling = currEnd ? currEnd.nextSibling : null;
    if (child == null || typeof child === "boolean") {
        console.log("removed", child);
        remove(element, currStart, currEnd);
        return [null, null];
    }
    if (typeof child === "string" || typeof child === "number") {
        if (currStart === null && currEnd instanceof Text) {
            currEnd.textContent = String(child);
            return [null, currEnd];
        }
        else {
            const textNode = document.createTextNode(String(child));
            remove(element, currStart, currEnd);
            element.insertBefore(textNode, nextSibling);
            return [null, textNode];
        }
    }
    if (child instanceof Node) {
        if (currStart === null && currEnd === child) {
            console.log("preserved", child);
            return [null, child];
        }
        else {
            if (currStart === null && currEnd) {
                console.log("replaced", child);
                element.replaceChild(child, currEnd);
            }
            else {
                remove(element, currStart, currEnd);
                console.log("inserted", child);
                element.insertBefore(child, nextSibling);
            }
            return [null, child];
        }
    }
    if (isSignal(child)) {
        return handleSignalChild(element, child, currStart, currEnd);
    }
    if (isFunction(child)) {
        return handleFunctionChild(element, child, currStart, currEnd);
    }
    if (Array.isArray(child)) {
        return handleArrayChild(element, child, currStart, currEnd);
    }
    throw new Error(`Unsupported child type: ${typeof child}`);
}
// function handleArrayChild(
//   element: Node,
//   children: Child[],
//   currStart: Marker,
//   currEnd: Marker
// ): [Marker, Marker] {
//   const nextSibling = currEnd ? currEnd.nextSibling : null;
//   let currMarker = currStart ?? currEnd;
//   const parent = currEnd?.parentNode ?? element;
//   let newStart: Marker = null,
//     newEnd: Marker = null;
//   for (const child of children) {
//     const [start, end] = resolveChild(parent, child, currMarker, currMarker);
//     if (!newStart) newStart = start;
//     newEnd = end;
//     currMarker = end ? end.nextSibling : null;
//   }
//   while (currMarker && currMarker !== nextSibling) {
//     const nextMarker = currMarker.nextSibling;
//     parent.removeChild(currMarker);
//     currMarker = nextMarker;
//   }
//   return [newStart, newEnd];
// }
function handleArrayChild(element, newChildren, currStart, currEnd) {
    const parent = currEnd?.parentNode ?? element;
    const oldChildren = [];
    let node = currStart ?? element.firstChild;
    const boundary = currEnd ? currEnd.nextSibling : null;
    // Collect old children
    while (node && node !== boundary) {
        oldChildren.push(node);
        node = node.nextSibling;
    }
    let oldStartIdx = 0;
    let newStartIdx = 0;
    let oldEndIdx = oldChildren.length - 1;
    let newEndIdx = newChildren.length - 1;
    let oldStartNode = oldChildren[0];
    let newStartChild = newChildren[0];
    let oldEndNode = oldChildren[oldEndIdx];
    let newEndChild = newChildren[newEndIdx];
    let newStart = null;
    let newEnd = null;
    const keyMap = new Map();
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
        if (!oldStartNode) {
            oldStartNode = oldChildren[++oldStartIdx];
        }
        else if (!oldEndNode) {
            oldEndNode = oldChildren[--oldEndIdx];
        }
        else if (isSameNode(oldStartNode, newStartChild)) {
            [newStart, newEnd] = updateExistingChild(parent, oldStartNode, newStartChild, newStart, newEnd);
            oldStartNode = oldChildren[++oldStartIdx];
            newStartChild = newChildren[++newStartIdx];
        }
        else if (isSameNode(oldEndNode, newEndChild)) {
            [newStart, newEnd] = updateExistingChild(parent, oldEndNode, newEndChild, newStart, newEnd);
            oldEndNode = oldChildren[--oldEndIdx];
            newEndChild = newChildren[--newEndIdx];
        }
        else if (isSameNode(oldStartNode, newEndChild)) {
            [newStart, newEnd] = updateExistingChild(parent, oldStartNode, newEndChild, newStart, newEnd);
            parent.insertBefore(oldStartNode, oldEndNode.nextSibling);
            oldStartNode = oldChildren[++oldStartIdx];
            newEndChild = newChildren[--newEndIdx];
        }
        else if (isSameNode(oldEndNode, newStartChild)) {
            [newStart, newEnd] = updateExistingChild(parent, oldEndNode, newStartChild, newStart, newEnd);
            parent.insertBefore(oldEndNode, oldStartNode);
            oldEndNode = oldChildren[--oldEndIdx];
            newStartChild = newChildren[++newStartIdx];
        }
        else {
            if (!keyMap.size) {
                for (let i = oldStartIdx; i <= oldEndIdx; i++) {
                    const key = getKey(oldChildren[i]);
                    if (key !== null) {
                        keyMap.set(key, i);
                    }
                }
            }
            const key = getKey(newStartChild);
            const oldIndex = key !== null ? keyMap.get(key) : undefined;
            if (oldIndex === undefined) {
                const [start, end] = resolveChild(parent, newStartChild, null, oldStartNode);
                if (!newStart)
                    newStart = start ?? end;
                newEnd = end ?? newStart;
                newStartChild = newChildren[++newStartIdx];
            }
            else {
                const nodeToMove = oldChildren[oldIndex];
                [newStart, newEnd] = updateExistingChild(parent, nodeToMove, newStartChild, newStart, newEnd);
                oldChildren[oldIndex] = null;
                parent.insertBefore(nodeToMove, oldStartNode);
                newStartChild = newChildren[++newStartIdx];
            }
        }
    }
    if (oldStartIdx > oldEndIdx) {
        const refNode = newChildren[newEndIdx + 1] instanceof Node
            ? newChildren[newEndIdx + 1]
            : null;
        for (let i = newStartIdx; i <= newEndIdx; i++) {
            const [start, end] = resolveChild(parent, newChildren[i], null, refNode);
            if (!newStart)
                newStart = start ?? end;
            newEnd = end ?? newStart;
        }
    }
    else if (newStartIdx > newEndIdx) {
        for (let i = oldStartIdx; i <= oldEndIdx; i++) {
            if (oldChildren[i]) {
                remove(parent, oldChildren[i], oldChildren[i]);
            }
        }
    }
    return [newStart, newEnd];
}
function isSameNode(node, child) {
    if (!(child instanceof Node))
        return false;
    if (node.nodeType !== child.nodeType)
        return false;
    if (node.nodeType === Node.ELEMENT_NODE) {
        return node.tagName === child.tagName;
    }
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent === child.textContent;
    }
    return false;
}
function getKey(node) {
    if (node instanceof Element && node.hasAttribute("key")) {
        return node.getAttribute("key");
    }
    return null;
}
function updateExistingChild(parent, oldNode, newChild, currentStart, currentEnd) {
    const [start, end] = resolveChild(parent, newChild, null, oldNode);
    if (!currentStart)
        currentStart = start ?? end ?? oldNode;
    currentEnd = end ?? start ?? oldNode;
    return [currentStart, currentEnd];
}
function handleProps(element, props) {
    Object.entries(props).forEach(([key, value]) => {
        if (key.startsWith("on") && isFunction(value)) {
            const event = key.slice(2).toLowerCase();
            element.addEventListener(event, value);
        }
        else if (key === "style" && typeof value === "object") {
            handleStyleObject(element, value);
        }
        else {
            handleAttribute(element, key, value);
        }
    });
}
function handleStyleObject(element, styleObj) {
    Object.entries(styleObj).forEach(([prop, value]) => {
        if (isSignal(value) || isFunction(value)) {
            effect(() => {
                setStyleProperty(element.style, prop, value());
            });
        }
        else {
            setStyleProperty(element.style, prop, value);
        }
    });
}
function setStyleProperty(style, prop, value) {
    if (prop in style) {
        style[prop] =
            typeof value === "number" && prop !== "zIndex" ? `${value}px` : value;
    }
    else {
        style.setProperty(prop, value.toString());
    }
}
function handleAttribute(element, key, value) {
    const setter = getPropSetter(element, key);
    if (isSignal(value) || isFunction(value)) {
        effect(() => {
            setter ? setter(value()) : element.setAttribute(key, String(value()));
        });
    }
    else {
        setter ? setter(value) : element.setAttribute(key, String(value));
    }
}
function getPropDescriptor(proto, key) {
    return proto
        ? Object.getOwnPropertyDescriptor(proto, key) ??
            getPropDescriptor(getProto(proto), key)
        : undefined;
}
function getPropSetter(element, key) {
    const setter = getPropDescriptor(getProto(element), key)?.set;
    return setter ? setter.bind(element) : undefined;
}
export const tags = new Proxy(createElement, {
    get(target, name) {
        return target.bind(null, name);
    },
});
export function Component(fn) {
    return (props) => {
        return unTrack(() => {
            return createRoot((dispose) => {
                onCleanup(dispose);
                const finalProps = props || {};
                finalProps.children = Array.isArray(finalProps.children)
                    ? finalProps.children
                    : finalProps.children !== undefined
                        ? [finalProps.children]
                        : [];
                return fn(finalProps);
            });
        });
    };
}
export function isHTMLTagName(value) {
    return typeof value === "string" && validTags.includes(value);
}

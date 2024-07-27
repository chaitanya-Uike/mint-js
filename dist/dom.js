import { effect, createRoot, unTrack, onCleanup } from "./core";
import { isSignal } from "./signals";
import { isFunction } from "./utils";
const getProto = Object.getPrototypeOf;
export const createElement = (name, ...args) => {
    const [props, ...children] = args[0] && Object.prototype.toString.call(args[0]) === "[object Object]"
        ? args
        : [{}, ...args];
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
        markers = resolveChild(element, signal(), markers[0], markers[1]);
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
        parent.removeChild(current);
        current = next;
    }
}
function insertBefore(parent, node, refNode) {
    parent.insertBefore(node, refNode);
}
function resolveChild(element, child, currStart, currEnd) {
    const nextSibling = currEnd ? currEnd.nextSibling : null;
    if (child == null || typeof child === "boolean") {
        remove(element, currStart, currEnd);
        return [null, null];
    }
    if (typeof child === "string" || typeof child === "number") {
        if (currStart && currStart === currEnd && currStart instanceof Text) {
            currStart.textContent = String(child);
            return [currStart, currStart];
        }
        else {
            const textNode = document.createTextNode(String(child));
            remove(element, currStart, currEnd);
            insertBefore(element, textNode, nextSibling);
            return [textNode, textNode];
        }
    }
    if (child instanceof Node) {
        if (currStart === child && currEnd === child) {
            return [child, child];
        }
        else {
            remove(element, currStart, currEnd);
            insertBefore(element, child, nextSibling);
            return [child, child];
        }
    }
    if (isSignal(child)) {
        return handleSignalChild(element, child, currStart, currEnd);
    }
    if (isFunction(child)) {
        return handleFunctionChild(element, child, currStart, currEnd);
    }
    if (Array.isArray(child)) {
        return handleArrayChild(element, child, currStart, currEnd, nextSibling);
    }
    throw new Error(`Unsupported child type: ${typeof child}`);
}
function handleArrayChild(element, children, currStart, currEnd, nextSibling) {
    remove(element, currStart, currEnd);
    const fragment = document.createDocumentFragment();
    const [start, end] = appendChildren(fragment, children);
    insertBefore(element, fragment, nextSibling);
    return [start, end];
}
function handleProps(element, props) {
    Object.entries(props).forEach(([key, value]) => {
        if (key.startsWith("on") && isFunction(value)) {
            const event = key.slice(2).toLowerCase();
            element.addEventListener(event, value);
            onCleanup(() => element.removeEventListener(event, value));
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
    return (props, ...children) => {
        return unTrack(() => {
            return createRoot((dispose) => {
                onCleanup(dispose);
                return fn(props, ...children);
            });
        });
    };
}
export function isHTMLTagName(value) {
    const validTags = [
        "div",
        "span",
        "p",
        "a",
        "img",
        "button",
        "input",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "table",
        "tr",
        "td",
        "th",
        "form",
        "label",
    ];
    return typeof value === "string" && validTags.includes(value);
}

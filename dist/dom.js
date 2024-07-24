import { effect, createRoot, unTrack, onCleanup } from "./core";
import { isSignal } from "./signals";
const getProto = Object.getPrototypeOf;
const OBJECT_PROTO = getProto({});
const isFunc = (value) => typeof value === "function";
const createElement = (name, ...args) => {
    const [props, ...children] = args[0] && getProto(args[0]) === OBJECT_PROTO
        ? args
        : [{}, ...args];
    const element = document.createElement(name);
    handleProps(element, props);
    appendChildren(element, children);
    return element;
};
function appendChildren(element, children) {
    children.forEach((child) => {
        if (Array.isArray(child)) {
            appendChildren(element, child);
        }
        else {
            appendChild(element, child);
        }
    });
}
function appendChild(element, child) {
    if (child == null || typeof child === "boolean")
        return;
    if (typeof child === "string" || typeof child === "number") {
        element.appendChild(document.createTextNode(child.toString()));
    }
    else if (child instanceof Node) {
        element.appendChild(child);
    }
    else if (isSignal(child)) {
        handleSignalChild(element, child);
    }
    else if (isFunc(child)) {
        handleFunctionChild(element, child);
    }
}
function handleSignalChild(element, child) {
    const textNode = document.createTextNode(child().toString());
    element.appendChild(textNode);
    effect(() => {
        textNode.nodeValue = child().toString();
    });
}
function handleFunctionChild(element, child) {
    let start = null;
    let end = null;
    effect(() => {
        const childValue = createRoot((disposeFn) => {
            onCleanup(disposeFn);
            return child();
        });
        [start, end] = updateChild(element, childValue, start, end);
    });
}
function updateChild(element, value, currStart, currEnd) {
    if (currStart !== null || currEnd !== null) {
        remove(element, currStart, currEnd);
    }
    return resolveChild(element, value);
}
function remove(element, start, end) {
    if (end) {
        let current = start ?? end;
        while (current && current !== end.nextSibling) {
            const next = current.nextSibling;
            element.removeChild(current);
            current = next;
        }
    }
}
function resolveChild(element, child) {
    let start = null, end = null;
    if (child == null || typeof child === "boolean") {
    }
    else if (typeof child === "string" || typeof child === "number") {
        end = document.createTextNode(String(child));
        element.appendChild(end);
    }
    else if (child instanceof Node) {
        end = child;
        element.appendChild(end);
    }
    else if (isSignal(child)) {
        end = document.createTextNode(String(child()));
        element.appendChild(end);
    }
    else if (isFunc(child))
        [start, end] = resolveChild(element, child());
    else if (Array.isArray(child)) {
        const fragment = document.createDocumentFragment();
        appendChildren(fragment, child);
        end = fragment.lastChild;
        if (fragment.firstChild !== end)
            start = fragment.firstChild;
        console.log(start, end);
        element.appendChild(fragment);
    }
    return [start, end];
}
function handleProps(element, props) {
    Object.entries(props).forEach(([key, value]) => {
        if (key.startsWith("on") && isFunc(value)) {
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
        if (isSignal(value) || isFunc(value)) {
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
    if (isSignal(value) || isFunc(value)) {
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
    return (...args) => {
        return unTrack(() => {
            return fn(...args);
        });
    };
}

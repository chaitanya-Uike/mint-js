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
    let start = null;
    let end = null;
    children.forEach(resolveChild.bind(null, element));
    end = element.lastChild;
    if (element.firstChild !== end)
        start = element.firstChild;
    return [start, end];
}
function handleSignalChild(element, child) {
    const textNode = document.createTextNode(child().toString());
    element.appendChild(textNode);
    effect(() => {
        textNode.nodeValue = child().toString();
    });
    return [null, textNode];
}
function handleFunctionChild(element, child) {
    let markers = [null, null];
    effect(() => {
        const childValue = createRoot((disposeFn) => {
            onCleanup(disposeFn);
            return child();
        });
        markers = updateChild(element, childValue, ...markers);
    });
    return markers;
}
function updateChild(element, value, currStart, currEnd) {
    remove(element, currStart, currEnd);
    return resolveChild(element, value);
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
function resolveChild(element, child) {
    if (child == null || typeof child === "boolean") {
        return [null, null];
    }
    if (typeof child === "string" || typeof child === "number") {
        const textNode = document.createTextNode(String(child));
        element.appendChild(textNode);
        return [textNode, textNode];
    }
    if (child instanceof Node) {
        element.appendChild(child);
        return [child, child];
    }
    if (isSignal(child)) {
        return handleSignalChild(element, child);
    }
    if (isFunc(child)) {
        return handleFunctionChild(element, child);
    }
    if (Array.isArray(child)) {
        const fragment = document.createDocumentFragment();
        appendChildren(fragment, child);
        const start = fragment.firstChild;
        const end = fragment.lastChild;
        element.appendChild(fragment);
        return [start, end];
    }
    throw new Error(`Unsupported child type: ${typeof child}`);
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
            return createRoot((dispose) => {
                onCleanup(dispose);
                return fn(...args);
            });
        });
    };
}

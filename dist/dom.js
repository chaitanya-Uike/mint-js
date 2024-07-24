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
    let currentNode = null;
    let dispose;
    effect(() => {
        const childValue = createRoot((disposeFn) => {
            dispose = disposeFn;
            return child();
        });
        const value = resolveChild(childValue);
        updateChild(element, value, currentNode, (node) => {
            currentNode = node;
        });
        onCleanup(dispose);
    });
}
function updateChild(element, value, currentNode, setCurrentNode) {
    if (currentNode) {
        if (value == null) {
            element.removeChild(currentNode);
            setCurrentNode(null);
        }
        else if (value instanceof Node) {
            if (currentNode !== value) {
                element.replaceChild(value, currentNode);
                setCurrentNode(value);
            }
        }
        else {
            currentNode.nodeValue = value;
        }
    }
    else if (value != null) {
        const newNode = value instanceof Node ? value : document.createTextNode(value);
        element.appendChild(newNode);
        setCurrentNode(newNode);
    }
}
function resolveChild(child) {
    if (child == null || typeof child === "boolean")
        return null;
    if (typeof child === "string" || typeof child === "number")
        return String(child);
    if (child instanceof Node)
        return child;
    if (isSignal(child))
        return child().toString();
    if (isFunc(child))
        return resolveChild(child());
    if (Array.isArray(child)) {
        //TODO will need to update this later
        const wrapper = document.createElement("div");
        appendChildren(wrapper, child);
        return wrapper;
    }
    return null;
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

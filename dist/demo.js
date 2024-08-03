import { effect } from "./core";
import { isSignal } from "./signals";
import { isFunction } from "./utils";
const getProto = Object.getPrototypeOf;
export const createElement = (name, ...args) => {
    const [props, ...children] = args[0] && getProto(args[0]) === Object.prototype
        ? args
        : [{}, ...args];
    const element = document.createElement(name);
    handleProps(element, props);
    appendChildren(element, children);
    return element;
};
function appendChildren(element, children) {
    for (const child of children) {
    }
}
function insertChild(element, child) {
    if (typeof child === "string") {
        element.appendChild(document.createTextNode(child));
    }
    else if (typeof child === "number" ||
        typeof child === "boolean" ||
        child instanceof Date) {
        element.appendChild(document.createTextNode(child.toString()));
    }
    else if (child instanceof Node) {
        element.appendChild(child);
    }
    else if (Array.isArray(child)) {
        child.forEach(insertChild.bind(null, element));
    }
    else if (typeof child === "function") {
    }
}
function handleDynamicChild(parent, value, current, marker, unWrapArray) {
    while (typeof current === "function")
        current = current();
    if (typeof value === current)
        return current;
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

import { effect, createRoot, unTrack, onCleanup } from "./core";
import { isSignal, Signal } from "./signals";
import type {
  Child,
  ChildFunction,
  Children,
  CreateElement,
  PrimitiveChild,
  Props,
  StyleObject,
  TagsObject,
} from "./types";

const getProto = Object.getPrototypeOf;
const OBJECT_PROTO = getProto({});

const isFunc = (value: any): value is Function => typeof value === "function";

const createElement: CreateElement = (name, ...args) => {
  const [props, ...children] =
    args[0] && getProto(args[0]) === OBJECT_PROTO
      ? (args as [Props, ...Children])
      : ([{}, ...args] as [Props, ...Children]);

  const element = document.createElement(name);

  handleProps(element, props);
  appendChildren(element, children);

  return element;
};

function appendChildren(element: HTMLElement, children: Children): void {
  children.forEach((child) => {
    if (Array.isArray(child)) {
      appendChildren(element, child);
    } else {
      appendChild(element, child);
    }
  });
}

function appendChild(element: HTMLElement, child: Child): void {
  if (child == null || typeof child === "boolean") return;

  if (typeof child === "string" || typeof child === "number") {
    element.appendChild(document.createTextNode(child.toString()));
  } else if (child instanceof Node) {
    element.appendChild(child);
  } else if (isSignal(child)) {
    handleSignalChild(element, child);
  } else if (isFunc(child)) {
    handleFunctionChild(element, child);
  }
}

function handleSignalChild(
  element: HTMLElement,
  child: Signal<PrimitiveChild>
): void {
  const textNode = document.createTextNode(child().toString());
  element.appendChild(textNode);
  effect(() => {
    textNode.nodeValue = child().toString();
  });
}

function handleFunctionChild(element: HTMLElement, child: ChildFunction): void {
  let currentNode: Node | null = null;
  let dispose: () => void;
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

function updateChild(
  element: HTMLElement,
  value: string | Node | null,
  currentNode: Node | null,
  setCurrentNode: (node: Node | null) => void
): void {
  if (currentNode) {
    if (value == null) {
      element.removeChild(currentNode);
      setCurrentNode(null);
    } else if (value instanceof Node) {
      if (currentNode !== value) {
        element.replaceChild(value, currentNode);
        setCurrentNode(value);
      }
    } else {
      currentNode.nodeValue = value;
    }
  } else if (value != null) {
    const newNode =
      value instanceof Node ? value : document.createTextNode(value);
    element.appendChild(newNode);
    setCurrentNode(newNode);
  }
}

function resolveChild(child: Child): string | Node | null {
  if (child == null || typeof child === "boolean") return null;
  if (typeof child === "string" || typeof child === "number")
    return String(child);
  if (child instanceof Node) return child;
  if (isSignal(child)) return child().toString();
  if (isFunc(child)) return resolveChild(child());
  if (Array.isArray(child)) {
    //TODO will need to update this later
    const wrapper = document.createElement("div");
    appendChildren(wrapper, child);
    return wrapper;
  }
  return null;
}

function handleProps(element: HTMLElement, props: Props): void {
  Object.entries(props).forEach(([key, value]) => {
    if (key.startsWith("on") && isFunc(value)) {
      const event = key.slice(2).toLowerCase();
      element.addEventListener(event, value);
      onCleanup(() => element.removeEventListener(event, value));
    } else if (key === "style" && typeof value === "object") {
      handleStyleObject(element, value as StyleObject);
    } else {
      handleAttribute(element, key, value);
    }
  });
}

function handleStyleObject(element: HTMLElement, styleObj: StyleObject): void {
  Object.entries(styleObj).forEach(([prop, value]) => {
    if (isSignal(value) || isFunc(value)) {
      effect(() => {
        setStyleProperty(element.style, prop, value());
      });
    } else {
      setStyleProperty(element.style, prop, value);
    }
  });
}

function setStyleProperty(
  style: CSSStyleDeclaration,
  prop: string,
  value: string | number
): void {
  if (prop in style) {
    (style as any)[prop] =
      typeof value === "number" && prop !== "zIndex" ? `${value}px` : value;
  } else {
    style.setProperty(prop, value.toString());
  }
}

function handleAttribute(
  element: HTMLElement,
  key: string,
  value: unknown
): void {
  const setter = getPropSetter(element, key);
  if (isSignal(value) || isFunc(value)) {
    effect(() => {
      setter ? setter(value()) : element.setAttribute(key, String(value()));
    });
  } else {
    setter ? setter(value) : element.setAttribute(key, String(value));
  }
}

function getPropDescriptor(
  proto: PropertyDescriptor | undefined,
  key: string
): PropertyDescriptor | undefined {
  return proto
    ? Object.getOwnPropertyDescriptor(proto, key) ??
        getPropDescriptor(getProto(proto), key)
    : undefined;
}

function getPropSetter(element: HTMLElement, key: string) {
  const setter = getPropDescriptor(getProto(element), key)?.set;
  return setter ? setter.bind(element) : undefined;
}

export const tags = new Proxy(createElement, {
  get(target, name: string) {
    return target.bind(null, name);
  },
}) as unknown as TagsObject;

type FnType = (...args: any[]) => Child;

export function Component<T extends FnType>(
  fn: T
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    return unTrack(() => {
      return fn(...args) as ReturnType<T>;
    });
  };
}

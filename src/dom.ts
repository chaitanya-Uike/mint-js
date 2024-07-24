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

function appendChildren(element: Node, children: Child[]): [Marker, Marker] {
  let start: Marker = null;
  let end: Marker = null;
  for (let i = 0; i < children.length; i++) {
    const [childStart, childEnd] = resolveChild(element, children[i]);
    if (i === 0) start = childStart;
    if (i === children.length - 1) end = childEnd;
  }
  return [start, end];
}

function handleSignalChild(
  element: Node,
  child: Signal<PrimitiveChild>
): [Marker, Marker] {
  const textNode = document.createTextNode(child().toString());
  element.appendChild(textNode);
  effect(() => {
    textNode.nodeValue = child().toString();
  });
  return [null, textNode];
}

type Marker = Node | null;

function handleFunctionChild(
  element: Node,
  child: ChildFunction
): [Marker, Marker] {
  let markers: [Marker, Marker] = [null, null];
  effect(() => {
    const childValue = createRoot((disposeFn) => {
      onCleanup(disposeFn);
      return child();
    });
    markers = updateChild(element, childValue, ...markers);
  });
  return markers;
}

function updateChild(
  element: Node,
  value: Child,
  currStart: Marker,
  currEnd: Marker
): [Marker, Marker] {
  remove(element, currStart, currEnd);
  return resolveChild(element, value);
}

function remove(element: Node, start: Marker, end: Marker): void {
  if (!start && !end) return;

  const parent = end?.parentNode ?? element;
  let current: Node | null = start ?? end;
  const stopNode = end ? end.nextSibling : null;

  while (current && current !== stopNode) {
    const next: Node | null = current.nextSibling;
    parent.removeChild(current);
    current = next;
  }
}

function resolveChild(element: Node, child: Child): [Marker, Marker] {
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

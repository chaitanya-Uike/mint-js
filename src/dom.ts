import { validTags } from "./constants";
import { effect, createRoot, unTrack, onCleanup } from "./core";
import { isSignal, Signal } from "./signals";
import type {
  Child,
  CreateElement,
  Props,
  StyleObject,
  TagsObject,
  Marker,
  HTMLTagName,
} from "./types";
import { isFunction } from "./utils";

const getProto = Object.getPrototypeOf;

export const createElement: CreateElement = (name, ...args) => {
  const [props, ...children] =
    args[0] && Object.prototype.toString.call(args[0]) === "[object Object]"
      ? (args as [Props, ...Child[]])
      : ([{}, ...args] as [Props, ...Child[]]);
  if (!isHTMLTagName(name)) throw new Error(`invalid node type ${name}`);
  const element = document.createElement(name);
  handleProps(element, props);
  appendChildren(element, children);
  return element;
};

function appendChildren(parent: Node, children: Child[]): [Marker, Marker] {
  let start: Marker = null;
  let end: Marker = null;
  for (const child of children) {
    const [childStart, childEnd] = resolveChild(parent, child, null, null);
    if (!start) start = childStart;
    end = childEnd;
  }
  return [start, end];
}

function handleSignalChild(
  element: Node,
  signal: Signal<Child>,
  currStart: Marker,
  currEnd: Marker
): [Marker, Marker] {
  let markers: [Marker, Marker] = [currStart, currEnd];
  effect(() => {
    const value = signal();
    markers = resolveChild(element, value, markers[0], markers[1]);
  });
  return markers;
}

function handleFunctionChild(
  element: Node,
  func: () => Child,
  currStart: Marker,
  currEnd: Marker
): [Marker, Marker] {
  let markers: [Marker, Marker] = [currStart, currEnd];
  effect(() => {
    const childValue = createRoot((dispose) => {
      onCleanup(dispose);
      return func();
    });
    markers = resolveChild(element, childValue, markers[0], markers[1]);
  });
  return markers;
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

function resolveChild(
  element: Node,
  child: Child,
  currStart: Marker,
  currEnd: Marker
): [Marker, Marker] {
  const nextSibling = currEnd ? currEnd.nextSibling : null;

  if (child == null || typeof child === "boolean") {
    remove(element, currStart, currEnd);
    return [null, null];
  }

  if (typeof child === "string" || typeof child === "number") {
    if (currStart && currStart === currEnd && currStart instanceof Text) {
      currStart.textContent = String(child);
      return [currStart, currStart];
    } else {
      const textNode = document.createTextNode(String(child));
      remove(element, currStart, currEnd);
      element.insertBefore(textNode, nextSibling);
      return [textNode, textNode];
    }
  }

  if (child instanceof Node) {
    if (currStart === child && currEnd === child) {
      return [child, child];
    } else {
      if (currEnd && currStart === currEnd) {
        element.replaceChild(child, currEnd);
      } else {
        remove(element, currStart, currEnd);
        element.insertBefore(child, nextSibling);
      }
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

function handleArrayChild(
  element: Node,
  children: Child[],
  currStart: Marker,
  currEnd: Marker,
  nextSibling: Node | null
): [Marker, Marker] {
  let currMarker = currStart ?? currEnd;
  const parent = currEnd?.parentNode ?? element;
  let newStart: Marker = null,
    newEnd: Marker = null;
  for (const child of children) {
    const [start, end] = resolveChild(parent, child, currMarker, currMarker);
    if (!newStart) newStart = start;
    newEnd = end;
    currMarker = end ? end.nextSibling : null;
  }
  while (currMarker && currMarker !== nextSibling) {
    const nextMarker = currMarker.nextSibling;
    parent.removeChild(currMarker);
    currMarker = nextMarker;
  }
  return [newStart, newEnd];
}

function handleProps(element: HTMLElement, props: Props): void {
  Object.entries(props).forEach(([key, value]) => {
    if (key.startsWith("on") && isFunction(value)) {
      const event = key.slice(2).toLowerCase();
      element.addEventListener(event, value);
    } else if (key === "style" && typeof value === "object") {
      handleStyleObject(element, value as StyleObject);
    } else {
      handleAttribute(element, key, value);
    }
  });
}

function handleStyleObject(element: HTMLElement, styleObj: StyleObject): void {
  Object.entries(styleObj).forEach(([prop, value]) => {
    if (isSignal(value) || isFunction(value)) {
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
  if (isSignal(value) || isFunction(value)) {
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
    return target.bind(null, name as HTMLTagName);
  },
}) as unknown as TagsObject;

export type ComponentFunction = (props: Props, ...children: Child[]) => Node;

export function Component<P extends Props = {}>(
  fn: (props: P & { children?: Child[] }) => Node
): (props?: P & { children?: Child[] }) => Node {
  return (props?: P & { children?: Child[] }): Node => {
    return unTrack(() => {
      return createRoot((dispose) => {
        onCleanup(dispose);
        const finalProps = props || ({} as P & { children?: Child[] });
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

export function isHTMLTagName(value: any): value is HTMLTagName {
  return typeof value === "string" && validTags.includes(value as HTMLTagName);
}

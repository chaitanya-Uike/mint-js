import { validTags } from "./constants";
import { effect, createRoot, unTrack, onCleanup } from "./core";
import { isSignal, Signal } from "./signals";
import type { Child, CreateElement, Props, StyleObject, TagsObject, Marker, HTMLTagName } from "./types";
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

function handleSignalChild(element: Node, signal: Signal<Child>, currStart: Marker, currEnd: Marker): [Marker, Marker] {
  let markers: [Marker, Marker] = [currStart, currEnd];
  effect(() => {
    const value = signal();
    markers = resolveChild(element, value, markers[0], markers[1]);
  });
  return markers;
}

function handleFunctionChild(element: Node, func: () => Child, currStart: Marker, currEnd: Marker): [Marker, Marker] {
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
    console.log("removed", current);
    parent.removeChild(current);
    current = next;
  }
}

function resolveChild(element: Node, child: Child, currStart: Marker, currEnd: Marker): [Marker, Marker] {
  const nextSibling = currEnd ? currEnd.nextSibling : null;

  if (child == null || typeof child === "boolean") {
    remove(element, currStart, currEnd);
    return [null, null];
  }

  if (typeof child === "string" || typeof child === "number") {
    if (currStart === null && currEnd instanceof Text) {
      console.log("update textcontent", currEnd);
      currEnd.textContent = String(child);
      return [null, currEnd];
    } else {
      const textNode = document.createTextNode(String(child));
      remove(element, currStart, currEnd);
      console.log("insert text", textNode);
      element.insertBefore(textNode, nextSibling);
      return [null, textNode];
    }
  }

  if (child instanceof Node) {
    if (currStart === null && currEnd === child) {
      console.log("preserved");
      return [null, child];
    } else {
      if (currStart === null && currEnd) {
        console.log("replaced");
        element.replaceChild(child, currEnd);
      } else {
        remove(element, currStart, currEnd);
        console.log("insert", child);
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

function handleArrayChild(element: Node, children: Child[], currStart: Marker, currEnd: Marker): [Marker, Marker] {
  const cache: Node[] = [];
  const parent = currEnd?.parentNode ?? element;
  const boundary = currEnd ? currEnd.nextSibling : null;
  let currNode = currStart ?? currEnd;
  while (currNode && currNode !== boundary) {
    cache.push(currNode);
    currNode = currNode.nextSibling;
  }
  let newStart: Marker = null;
  let newEnd: Marker = null;

  // Create a map to track the indices of children
  const childIndices = new Map<Node, number>();
  children.forEach((child, index) => {
    if (child instanceof Node) {
      childIndices.set(child, index);
    }
  });

  let i = 0;
  while (i < cache.length) {
    const node = cache[i];
    const childIndex = childIndices.get(node);

    if (childIndex === undefined) {
      // Node is not in the new children array, remove it
      parent.removeChild(node);
      cache.splice(i, 1);
    } else {
      // Node is in the new children array, keep it and update newStart/newEnd
      if (!newStart) newStart = node;
      newEnd = node;
      i++;
    }
  }

  // Add any new children that weren't in the original cache
  for (let idx = 0; idx < children.length; idx++) {
    const child = children[idx];
    if (child instanceof Node) {
      if (idx >= cache.length) {
        parent.appendChild(child);
        cache.push(child);
        if (!newStart) newStart = child;
        newEnd = child;
      } else if (cache[idx] !== child) {
        parent.insertBefore(child, cache[idx]);
        cache.splice(idx, 0, child);
        if (!newStart) newStart = child;
        newEnd = child;
      }
    } else {
      const existing = cache[idx] ?? null;
      const [start, end] = resolveChild(parent, child, null, existing);
      if (!existing) {
        cache.splice(idx, 0, start as Node);
      }
      if (!newStart) newStart = start;
      newEnd = end;
    }
  }

  return [newStart, newEnd];
}

function swapNodes(node1: Node, node2: Node) {
  const parent = node1.parentNode;
  const next1 = node1.nextSibling;
  const next2 = node2.nextSibling;
  if (parent) {
    console.log("swapped", node1, node2);
    parent.insertBefore(node1, next2);
    parent.insertBefore(node2, next1);
  }
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

function setStyleProperty(style: CSSStyleDeclaration, prop: string, value: string | number): void {
  if (prop in style) {
    (style as any)[prop] = typeof value === "number" && prop !== "zIndex" ? `${value}px` : value;
  } else {
    style.setProperty(prop, value.toString());
  }
}

function handleAttribute(element: HTMLElement, key: string, value: unknown): void {
  const setter = getPropSetter(element, key);
  if (isSignal(value) || isFunction(value)) {
    effect(() => {
      setter ? setter(value()) : element.setAttribute(key, String(value()));
    });
  } else {
    setter ? setter(value) : element.setAttribute(key, String(value));
  }
}

function getPropDescriptor(proto: PropertyDescriptor | undefined, key: string): PropertyDescriptor | undefined {
  return proto ? Object.getOwnPropertyDescriptor(proto, key) ?? getPropDescriptor(getProto(proto), key) : undefined;
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

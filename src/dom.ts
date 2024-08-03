import { effect, createRoot, unTrack, onCleanup } from "./core";
import { isSignal } from "./signals";
import type {
  Child,
  CreateElement,
  Props,
  StyleObject,
  Marker,
  ComponentFunction,
} from "./types";
import { isFunction } from "./utils";

const getProto = Object.getPrototypeOf;

export const createElement: CreateElement = (type, props) => {
  const element = document.createElement(type);
  appendChildren(element, props.children);
  handleProps(element, props);
  return element;
};

function appendChildren(element: Node, children: Child[]) {
  for (const child of children) {
    if (child == null) continue;
    else if (typeof child === "string") {
      element.appendChild(document.createTextNode(child));
    } else if (
      typeof child === "number" ||
      typeof child === "boolean" ||
      child instanceof Date
    ) {
      element.appendChild(document.createTextNode(child.toString()));
    } else if (Array.isArray(child)) {
      appendChildren(element, child);
    } else if (child instanceof Node) {
      element.appendChild(child);
    } else if (typeof child === "function") {
      let markers: [Marker, Marker] = [null, null];
      effect(() => {
        markers = handleDynamicChild(element, child(), markers[0], markers[1]);
      });
    }
  }
}

function handleDynamicChild(
  element: Node,
  value: Child,
  startNode: Marker,
  endNode: Marker
): [Marker, Marker] {
  if (value == null || typeof value === "boolean") {
    const marker = document.createTextNode("");
    if (startNode && endNode) {
      removeNodesBetween(element, startNode, endNode);
      element.replaceChild(marker, endNode);
      startNode = null;
    } else if (endNode) {
      element.replaceChild(marker, endNode);
    } else {
      element.appendChild(marker);
    }
    endNode = marker;
  } else if (typeof value === "string" || typeof value === "number") {
    value = String(value);
    if (startNode && endNode) {
      removeNodesBetween(element, startNode, endNode);
      const textNode = document.createTextNode(value);
      element.replaceChild(textNode, endNode);
      startNode = null;
      endNode = textNode;
    } else if (endNode) {
      if (endNode instanceof Text && endNode.data !== value) {
        endNode.data = value;
      } else {
        const textNode = document.createTextNode(value);
        element.replaceChild(textNode, endNode);
        endNode = textNode;
      }
    } else {
      endNode = document.createTextNode(value);
      element.appendChild(endNode);
    }
  } else if (value instanceof Node) {
    if (startNode && endNode) {
      removeNodesBetween(element, startNode, endNode);
      element.replaceChild(value, endNode);
      startNode = null;
    } else if (endNode && endNode !== value) {
      element.replaceChild(value, endNode);
    } else if (!endNode) {
      element.appendChild(value);
    }
    endNode = value;
  } else if (typeof value === "function") {
    effect(() => {
      while (typeof value === "function") value = value();
      [startNode, endNode] = handleDynamicChild(
        element,
        value,
        startNode,
        endNode
      );
    });
  } else if (Array.isArray(value)) {
    const newNodes: Node[] = [];
    const dynamic = flattenArray(newNodes, value);
    if (dynamic) {
      effect(() => {
        [startNode, endNode] = handleDynamicChild(
          element,
          newNodes,
          startNode,
          endNode
        );
      });
    } else {
      if (newNodes.length === 0) {
        removeNodesBetween(element, startNode, endNode);
        const marker = document.createTextNode("");
        endNode
          ? element.replaceChild(marker, endNode)
          : element.appendChild(marker);
        endNode = marker;
        startNode = null;
      } else {
        const existingNodes = getNodesBetween(startNode, endNode);
        if (existingNodes.length === 0) {
          for (const node of newNodes) element.appendChild(node);
        } else reconcileArrays(element, existingNodes, newNodes);
        endNode = newNodes[newNodes.length - 1];
        startNode = newNodes.length > 1 ? newNodes[0] : null;
      }
    }
  }
  return [startNode, endNode];
}

function reconcileArrays(parentNode: Node, a: Node[], b: Node[]) {
  let bLength = b.length,
    aEnd = a.length,
    bEnd = bLength,
    aStart = 0,
    bStart = 0,
    after = a[aEnd - 1]?.nextSibling || null,
    map: Map<Node, number> | null = null;

  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node =
        bEnd < bLength
          ? bStart
            ? b[bStart - 1].nextSibling
            : b[bEnd - bStart]
          : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) {
          parentNode.removeChild(a[aStart]);
        }
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart,
            sequence = 1,
            t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else {
            parentNode.replaceChild(b[bStart++], a[aStart++]);
          }
        } else aStart++;
      } else {
        parentNode.removeChild(a[aStart++]);
      }
    }
  }
}

function flattenArray(result: Node[], values: Child[]): boolean {
  let dynamic = false;
  for (let value of values) {
    if (value == null || typeof value === "boolean") continue;
    else if (value instanceof Node) result.push(value);
    else if (Array.isArray(value))
      dynamic = flattenArray(result, value) || dynamic;
    else if (typeof value === "function") {
      while (typeof value === "function") value = value();
      dynamic =
        flattenArray(result, Array.isArray(value) ? value : [value]) || dynamic;
    } else {
      result.push(document.createTextNode(String(value)));
    }
  }
  return dynamic;
}

function removeNodesBetween(element: Node, startNode: Marker, endNode: Marker) {
  let currentNode = startNode;
  while (currentNode && currentNode !== endNode) {
    const nextNode = currentNode.nextSibling;
    element.removeChild(currentNode);
    currentNode = nextNode;
  }
}

function getNodesBetween(startNode: Marker, endNode: Marker) {
  const result: Node[] = [];
  let currentNode = startNode ?? endNode;
  while (currentNode && currentNode !== endNode?.nextSibling) {
    result.push(currentNode);
    currentNode = currentNode.nextSibling;
  }
  return result;
}

function handleProps(element: HTMLElement, props: Props): void {
  Object.entries(props).forEach(([key, value]) => {
    if (key === "children") return;
    else if (key.startsWith("on") && isFunction(value)) {
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

export function component(fn: ComponentFunction, props: Props): Node {
  return unTrack(() => {
    return createRoot((dispose) => {
      onCleanup(dispose);
      return fn(props);
    });
  });
}

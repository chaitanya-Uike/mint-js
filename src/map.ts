import { Store } from "./store";
import { isSignal, signal, Signal, createEffect } from "./signals";
import { createRoot } from "./core";

type MapCallback<T, U> = (item: T, index: number) => U;
type CleanupFunction = () => void;

export function reactiveMap<T, U>(
  list: Store<T[]> | Signal<T[]>,
  callback: MapCallback<T, U>
): Signal<U[]> {
  let cleanups: (CleanupFunction | null)[] = [];
  let mapped = signal<U[]>([]);
  let prevList: T[] = [];

  createEffect(() => {
    const currentList: T[] = isSignal(list) ? list() : list;
    const nextDispose: (CleanupFunction | null)[] = [];
    const nextMapped: U[] = [];

    for (let index = 0; index < currentList.length; index++) {
      const item = currentList[index];
      const prevIndex = prevList.findIndex((prevItem) => prevItem === item);

      if (prevIndex > -1) {
        nextMapped[index] = mapped()[prevIndex];
        nextDispose[index] = cleanups[prevIndex];
        cleanups[prevIndex] = null;
      } else {
        createRoot((disposer) => {
          nextDispose[index] = disposer;
          nextMapped[index] = callback(item, index);
        });
      }
    }

    cleanups = nextDispose;
    prevList = [...currentList];
    mapped.set(nextMapped);

    return () => {
      for (const cleanup of cleanups) cleanup?.();
    };
  });

  return mapped;
}

import { Store } from "./store";
import { isSignal, Signal } from "./signals";
import { effect, unTrack, onCleanup, createRoot } from "./core";

type MapCallback<T, U> = (item: T, index: number) => U;
type CleanupFunction = () => void;

export function reactiveMap<T, U>(
  list: Store<T[]> | Signal<T[]>,
  callback: MapCallback<T, U>
): U[] {
  let dispose: (CleanupFunction | null)[] = [];
  let mapped: U[] = [];
  let prevList: T[] = [];

  effect(() => {
    const currentList: T[] = isSignal(list) ? list() : list;
    const nextDispose: (CleanupFunction | null)[] = [];
    const nextMapped: U[] = [];

    for (const [index, item] of currentList.entries()) {
      const prevIndex = prevList.findIndex((prevItem) => prevItem === item);

      if (prevIndex > -1) {
        nextMapped[index] = mapped[prevIndex];
        nextDispose[index] = dispose[prevIndex];
        dispose[prevIndex] = null;
      } else {
        createRoot((disposer) => {
          nextDispose[index] = disposer;
          nextMapped[index] = unTrack(() => callback(item, index));
        });
      }
    }

    dispose = nextDispose;
    mapped = nextMapped;
    prevList = currentList;

    onCleanup(() => {
      for (const d of dispose) d?.();
    });
  });
  return mapped;
}

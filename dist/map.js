import { isSignal } from "./signals";
import { effect, unTrack, onCleanup, createRoot } from "./core";
export function reactiveMap(list, callback) {
    let dispose = [];
    let mapped = [];
    let prevList = [];
    effect(() => {
        const currentList = isSignal(list) ? list() : list;
        const nextDispose = [];
        const nextMapped = [];
        for (const [index, item] of currentList.entries()) {
            const prevIndex = prevList.findIndex((prevItem) => prevItem === item);
            if (prevIndex > -1) {
                nextMapped[index] = mapped[prevIndex];
                nextDispose[index] = dispose[prevIndex];
                dispose[prevIndex] = null;
            }
            else {
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
            for (const d of dispose)
                d?.();
        });
    });
    return mapped;
}

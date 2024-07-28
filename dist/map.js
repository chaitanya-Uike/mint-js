import { isSignal, signal, createEffect } from "./signals";
import { createRoot } from "./core";
export function reactiveMap(list, callback) {
    let cleanups = [];
    let mapped = signal([]);
    let prevList = [];
    createEffect(() => {
        const currentList = isSignal(list) ? list() : list;
        const nextDispose = [];
        const nextMapped = [];
        for (const [index, item] of currentList.entries()) {
            const prevIndex = prevList.findIndex((prevItem) => prevItem === item);
            if (prevIndex > -1) {
                nextMapped[index] = mapped()[prevIndex];
                nextDispose[index] = cleanups[prevIndex];
                cleanups[prevIndex] = null;
            }
            else {
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
            for (const cleanup of cleanups)
                cleanup?.();
        };
    });
    return mapped;
}

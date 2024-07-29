import { isSignal, signal, createEffect } from "./signals";
import { createRoot, unTrack } from "./core";
export function map(list, callback) {
    let cleanups = [];
    let mapped = signal([]);
    let prevList = [];
    createEffect(() => {
        const currentList = isSignal(list) ? list() : list;
        const nextDispose = [];
        const nextMapped = [];
        for (let index = 0; index < currentList.length; index++) {
            const item = currentList[index];
            const prevIndex = prevList.findIndex((prevItem) => prevItem === item);
            if (prevIndex > -1) {
                nextMapped[index] = unTrack(() => mapped()[prevIndex]);
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

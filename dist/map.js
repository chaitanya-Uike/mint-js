import { isSignal, signal } from "./signals";
import { effect, createRoot, unTrack } from "./core";
export function reactiveMap(list, callback) {
    let cleanups = [];
    let mapped = signal([]);
    let prevList = [];
    effect(() => {
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
        mapped.set(nextMapped);
        prevList = [...currentList];
        return () => {
            for (let i = 0; i < cleanups.length; i++) {
                console.log("cleanup", cleanups[i]);
                cleanups[i]?.();
            }
            cleanups = nextDispose;
        };
    });
    return mapped;
}

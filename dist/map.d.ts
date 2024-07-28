import { Store } from "./store";
import { Signal } from "./signals";
type MapCallback<T, U> = (item: T, index: number) => U;
export declare function reactiveMap<T, U>(list: Store<T[]> | Signal<T[]>, callback: MapCallback<T, U>): U[];
export {};

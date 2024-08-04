# Mint-js

Mint is a lightweight, fine-grained reactive frontend library.

## Installation

```bash
npm i https://github.com/chaitanya-Uike/mint-js
```

## Core Concepts

1. Signals
2. Effects
3. DOM Composition
4. Stores

## Signals

Signals are the fundamental units of reactivity in Mint-js. They are functions that both store and return a value, and can be updated using their `set` method. The value can be observed when used in reactive contexts like effects and other signals.

```javascript
import { signal } from "mint-js";

const count = signal(0);
console.log(count()); // 0
count.set(5);
console.log(count()); // 5

const a = signal(1);
const b = signal(() => a() * 2); // b now tracks a

console.log(b()); // 2
a.set((prevVal) => prevVal + 4); // set also accepts a callback
console.log(b()); // 10
```

## Effects

Effects are used to perform side effects in response to signal changes. Effects track all the signals accessed during their run and re-run only when their dependencies update. You can create effects using the `effect` function.

```javascript
import { effect } from "mint-js";

effect(() => {
  console.log(`The count is now ${count()}`);
});
```

`effect` invokes the given function each time any of the signals that are read inside are updated. The effect is also immediately invoked on initialization.

You can optionally return a function from inside the effect that will be run each time the effect re-runs and when it's finally stopped/disposed of:

```javascript
effect(() => {
  // Effect logic here
  return () => {
    // Cleanup logic here
    // Called each time effect re-runs and when disposed of
  };
});
```

### Examples

```javascript
const visible = signal(true);

effect(() => {
  if (visible()) {
    const timer = setInterval(() => {
      console.log("Tick");
    }, 1000);

    return () => clearInterval(timer); // This cleanup function will be called when visible becomes false
  }
});
```

#### onCleanup

you can also use the `onCleanup` function to handle cleanups inside effects.

```javascript
import { onCleanup } from "mint-js";

effect(() => {
  //do something

  onCleanup(() => {
    //cleanup logic
  });
});
```

#### flush

`effects` are executed asynchronously, they are scheduled on the microtask queue. To execute all the currently scheduled effects immediately use the `flush` function.

```javascript
import { flush } from "mint-js";

const a = signal(5);
effect(() => {
  a();
  //effect logic
});
a.set(100);
flush(); //execute the above effect immediately
```

#### Roots

`signals` and `effects` are garbage collected when their parent scope has finished execution and they are no
longer referenced.`signals` and `effects` can stay in memory if they reference any object outside their parent scope, this can cause memory leaks.

```javascript
const obj = {};

function func() {
  const a = signal(0); //will be garbage collected when func completes execution
  const b = signal(() => {
    obj; //do something with object
  }); //b will only be garbage collected after obj is
}
```

use `createRoot` function to create parent scopes. they provide a `dispose` function which can be called
to dispose off all the child `signals` and `effects`

```javascript
import { createRoot } from "mint-js";

createRoot((dispose) => {
  const a = signal(5);
  const b = signal(() => a() * 2);

  effect(() => {
    console.log(a(), b());
  });

  dispose(); //will dispose all signals and effects inside callback
});
```

`root`s can be nested inside each other, child roots get disposed off when parent root calls `dispose`.

```javascript
import { createRoot } from "mint-js";

createRoot((dispose) => {
  const a = signal(1);

  createRoot(() => {
    const b = signal(() => a() * 2);

    effect(() => {
      console.log(b());
    });
  });

  dispose(); //will dispose 'a' and the child root along with its signal and effects as well
});
```

#### unTrack

executes the callback with tracking disabled.

```javascript
import { unTrack } from "mint-js";

const a = signal(1);
const b = signal(5);
effect(() => {
  const res = unTrack(() => {
    return a() * b(); // the effect will not track 'a' and 'b'
  });
});
```

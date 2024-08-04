# Mint-js

Mint-js is a lightweight, fine-grained reactive frontend library designed for efficient and flexible state management in web applications.

## Installation

To install Mint-js, run the following command in your terminal:

```bash
npm i https://github.com/chaitanya-Uike/mint-js
```

## Signal

Signals are the core building blocks of reactivity in Mint-js. They serve as both storage containers and accessor functions for reactive values. Signals can be updated using their `set` method and automatically trigger updates in reactive contexts like effects and derived signals.

### Basic Usage

```javascript
import { signal } from "mint-js";

const count = signal(0);
console.log(count()); // Outputs: 0
count.set(5);
console.log(count()); // Outputs: 5
```

### Derived Signals

Signals can be derived from other signals, creating a dependency chain:

```javascript
const a = signal(1);
const b = signal(() => a() * 2); // b is now dependent on a

console.log(b()); // Outputs: 2
a.set((prevVal) => prevVal + 4); // Updating 'a' using a callback
console.log(b()); // Outputs: 10
```

## Effect

Effects are functions that automatically re-run when their dependent signals change. They're perfect for handling side effects in response to state changes.

### Basic Usage

```javascript
import { effect } from "mint-js";

const count = signal(0);

effect(() => {
  console.log(`The count is now ${count()}`);
});

// The effect runs immediately, logging: "The count is now 0"
count.set(5); // This will trigger the effect, logging: "The count is now 5"
```

### Cleanup Functions

Effects can return a cleanup function that runs before each re-execution and when the effect is disposed:

```javascript
const visible = signal(true);

effect(() => {
  if (visible()) {
    const timer = setInterval(() => {
      console.log("Tick");
    }, 1000);

    return () => clearInterval(timer);
    // This cleanup function will be called when visible becomes false
    // or when the effect is re-run or disposed
  }
});
```

## onCleanup

For more granular control over cleanup operations, you can use the `onCleanup` function within effects:

```javascript
import { onCleanup } from "mint-js";

effect(() => {
  const resource = acquireExpensiveResource();

  onCleanup(() => {
    releaseExpensiveResource(resource);
  });

  // Use the resource here
});
```

## Flush

After the first execution, effects are executed asynchronously by default. To immediately execute all scheduled effects, use the `flush` function:

```javascript
import { flush } from "mint-js";

const temperature = signal(20);
effect(() => {
  console.log(`Current temperature: ${temperature()}°C`);
});

temperature.set(25);
flush(); // Immediately logs: "Current temperature: 25°C"
```

## Roots

Roots provide a way to manage the lifecycle of signals and effects, preventing memory leaks and allowing for controlled disposal of reactive resources.

### Basic Usage

```javascript
import { createRoot } from "mint-js";

createRoot((dispose) => {
  const counter = signal(0);
  const doubleCounter = signal(() => counter() * 2);

  effect(() => {
    console.log(`Counter: ${counter()}, Double: ${doubleCounter()}`);
  });

  // Some time later...
  dispose(); // Cleans up all signals and effects created within this root
});
```

### Nested Roots

Roots can be nested, with child roots being disposed when their parent root is disposed:

```javascript
createRoot((disposeParent) => {
  const parentSignal = signal("parent");

  createRoot((disposeChild) => {
    const childSignal = signal("child");

    effect(() => {
      console.log(`${parentSignal()} - ${childSignal()}`);
    });

    // disposeChild(); // Would dispose only the child root
  });

  disposeParent(); // Disposes both parent and child roots
});
```

## unTrack

The `unTrack` function allows you to access signal values without creating dependencies:

```javascript
import { unTrack } from "mint-js";

const a = signal(1);
const b = signal(5);

effect(() => {
  const result = unTrack(() => {
    return a() * b(); // This computation won't be tracked by the effect
  });
  console.log(`Untracked result: ${result}`);
});

// Changing 'a' or 'b' won't trigger the effect
a.set(2);
b.set(10);
```

## Reactive Objects

In Mint-js, when objects or arrays are used as signals, they become reactive as a whole unit. However, their individual properties or elements don't automatically become reactive. This behavior can sometimes lead to unexpected results.

### Basic Reactive Object Example

```javascript
const user = signal({
  name: "John",
  age: 18,
});

effect(() => {
  console.log(`Name is ${user().name}`);
});

user.set((prev) => ({ ...prev, age: 20 })); // Update age
flush();
// This will log 'Name is John' even though we updated age
```

### Fine-grained Reactivity

To achieve more granular reactivity, it's recommended to create fine-grained reactive objects by wrapping individual properties in signals (use `store` for this):

```javascript
const user = {
  name: signal("John"),
  age: signal(18),
};

effect(() => {
  console.log(`Name is ${user.name()}`);
});

user.age.set(20); // Update age
// This won't trigger the above effect
user.name.set("John Doe");
flush();
// This will log 'Name is John Doe'
```

While this approach provides better granularity, it can become tedious for larger objects and make managing the disposal of signals challenging.

## Store

To address the limitations of manual fine-grained reactivity, Mint-js provides the `store` function. It creates an object that automatically wraps all its properties in signals, making them reactive individually.

### Basic Store Usage

```javascript
import { store } from "mint-js";

const user = store({
  name: "John",
  age: 18,
});

effect(() => {
  console.log(`Name is ${user.name}`); // Properties can be accessed normally
});
// Logs 'Name is John'

user.age = 20; // Properties can be updated normally without calling set
flush();
// Won't trigger the above effect

user.name = "John Doe";
flush();
// Will log 'Name is John Doe'
```

### Key Features of Stores

1. **Lazy Wrapping**: Stores only wrap properties in signals when they are accessed, avoiding unnecessary signal creation.
2. **Automatic Lifecycle Management**: Stores handle the lifecycle of created signals internally, simplifying memory management.
3. **Nested Reactivity**: Stores can be nested while maintaining fine-grained reactivity.

### Nested Stores Example

```javascript
const obj = store({
  user: { name: "John", age: 18 },
  enabled: true,
});

effect(() => {
  console.log(`Name is ${obj.user.name}`);
});
// Logs 'Name is John'

obj.user.name = "John Doe";
flush();
// Logs 'Name is John Doe'

obj.user = { name: "Sam", age: 40 }; // Complete reassignment of objects also works
flush();
// Logs 'Name is Sam'
```

### Stores with Signals and Derived Signals

Stores can also include signals and derived signals as properties:

```javascript
const baseValue = signal(5);

const obj = store({
  doubleValue: signal(() => baseValue() * 2),
});

effect(() => {
  console.log("Double value:", obj.doubleValue);
});
// Logs:
// Double value: 10

baseValue.set(10);
flush();
// Logs:
// Double value: 20
```

### Arrays as Stores

Arrays can also be used as stores, providing reactive behavior for array operations:

```javascript
const todos = store([
  { id: Date.now(), text: "Buy groceries", completed: false },
]);

effect(() => {
  console.log(`First todo: '${todos[0].text}'`);
});
// Logs "First todo: 'Buy groceries'"

todos[0].text = "Buy groceries in the morning";
flush();
// Logs "First todo: 'Buy groceries in the morning'"

effect(() => {
  console.log(
    "All todos:",
    todos.map((todo) => todo.text)
  );
});
flush();
// Logs "All todos: ['Buy groceries in the morning']"

todos.push({ id: Date.now(), text: "Study physics", completed: false });
flush();
// Logs "All todos: ['Buy groceries in the morning', 'Study physics']"
```

### Important Note on Property Access

Properties in a store become trackable at the point where they are accessed. This behavior can lead to unexpected results if you're not careful:

```javascript
const user = store({ firstName: "John", lastName: "Doe" });

function greet({ firstName, lastName }) {
  effect(() => {
    console.log(`Hello, ${firstName} ${lastName}!`);
  });
}

greet(user);
flush();
// Logs "Hello, John Doe!"

user.firstName = "Sam";
flush();
// Won't retrigger the effect because the properties were accessed in the function arguments

// To make it work as expected, access the properties inside the effect:
effect(() => {
  console.log(`Hello, ${user.firstName} ${user.lastName}!`);
});
```

By using stores, you can create reactive objects with fine-grained reactivity while maintaining a clean and intuitive API. This approach simplifies state management in complex applications and helps avoid common pitfalls associated with manual signal creation for object properties.

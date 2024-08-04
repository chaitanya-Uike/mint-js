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

# DOM Composition in Mint-js

Mint-js provides a powerful and intuitive way to create and manipulate DOM elements using the `html` tagged template function. This approach offers JSX-like features without any build-time dependencies, enabling easy creation of dynamic and reactive user interfaces.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Syntax Highlighting](#syntax-highlighting)
3. [Dynamic Content](#dynamic-content)
4. [Attributes and Properties](#attributes-and-properties)
5. [Reactive Contexts](#reactive-contexts)
6. [Conditional Rendering](#conditional-rendering)
7. [Event Handling](#event-handling)
8. [Controlled Inputs](#controlled-inputs)
9. [Components](#components)
10. [Children](#children)

## Basic Usage

The `html` tagged template function creates DOM elements using a syntax that closely resembles HTML:

```javascript
import { html } from "mint-js";

const div = html`<div>Hello World!</div>`;
document.getElementById("app").appendChild(div);
```

This creates an actual DOM element that can be directly appended to the document.

## Syntax Highlighting

For an enhanced development experience, use the lit-html extension for Visual Studio Code. It provides syntax highlighting for `html` tagged template literals:

[lit-html VS Code Extension](https://marketplace.visualstudio.com/items?itemName=bierner.lit-html)

## Dynamic Content

The `html` function seamlessly incorporates dynamic content using `${}` notation:

```javascript
import { html, signal } from "mint-js";

const name = signal("Alice");
const greeting = html`<h1>Hello, ${name}!</h1>`;

document.getElementById("app").appendChild(greeting);

// Updating the signal automatically updates the DOM
name.set("Bob");
```

## Attributes and Properties

Both attributes and properties can be set dynamically:

```javascript
const isDisabled = signal(false);
const buttonText = signal("Click me");

const button = html`
  <button disabled=${isDisabled} onClick=${() => console.log("Clicked!")}>
    ${buttonText}
  </button>
`;

// Later updates automatically reflect in the DOM
isDisabled.set(true);
buttonText.set("Try again");
```

Note: When using signals as properties or children, you don't need to call the signal getter.

## Reactive Contexts

Create reactive contexts inside the `html` function using arrow functions:

```javascript
const show = signal(false);
html`<div style=${{ color: () => (show() ? "red" : "blue") }}>
  Hello World!
</div>`;

show.set(true); // Updates the div's color
```

Dynamic class names:

```javascript
html`
  <h1
    className=${() => `text-3xl ${show() ? "text-red-500" : "text-blue-500"}`}
  >
    Hello, ${name}!
  </h1>
`;
```

## Conditional Rendering

Use functions for reactive conditional rendering:

```javascript
const isLoggedIn = signal(false);
const username = signal("");

const loginStatus = html`
  ${() =>
    isLoggedIn()
      ? html`<p>Welcome, ${username}!</p>`
      : html`<p>Please log in.</p>`}
`;

// Later updates change the rendered content
isLoggedIn.set(true);
username.set("Alice");
```

## Event Handling

Handle events easily:

```javascript
const counter = signal(0);

const counterButton = html`
  <button onClick=${() => counter.set((c) => c + 1)}>Clicks: ${counter}</button>
`;
```

## Controlled Inputs

Create controlled inputs with ease:

```javascript
const name = signal("");
html`<input value=${name} onInput=${(e) => name.set(e.target.value)} />`;
```

## Components

Modularize your code by creating components. Components are functions that return DOM nodes and can have their own internal state:

```javascript
function Counter() {
  const count = signal(0);

  return html`<div>
    <button onClick=${() => count.set((c) => c - 1)}>-</button>
    ${count}
    <button onClick=${() => count.set((c) => c + 1)}>+</button>
  </div>`;
}

function App() {
  return html`<div><${Counter} /></div>`;
}
```

### Passing Props

Pass props to components:

```javascript
function Greet({ firstName, lastName }) {
  const fullName = signal(() => `${firstName()} ${lastName()}`);
  return html`<h1>Hello! ${fullName}</h1>`;
}

function App() {
  const firstName = signal("John");
  const lastName = signal("Doe");
  return html`<div>
    <${Greet} firstName=${firstName} lastName=${lastName} />
  </div>`;
}
```

Use the spread syntax for easier prop passing:

```javascript
function App() {
  const firstName = signal("John");
  const lastName = signal("Doe");
  return html`<div><${Greet} ...${{ firstName, lastName }} /></div>`;
}
```

## Children

The `children` prop is an array of child components:

```javascript
function App({ children }) {
  return html`<div>${children}</div>`;
}

document.getElementById("app").appendChild(html`
  <${App}>
    <${Header} />
    <${Main} />
    <${Footer} />
  <//>
`);
```

Note: You can close a component tag using `<//>` and `</${CompName}>`.

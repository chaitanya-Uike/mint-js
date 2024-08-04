# Mint-js Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Core Concepts](#core-concepts)
   - [Signal](#signal)
   - [Effect](#effect)
   - [onCleanup](#oncleanup)
   - [Flush](#flush)
   - [Roots](#roots)
   - [unTrack](#untrack)
4. [Reactive Objects](#reactive-objects)
5. [Store](#store)
6. [DOM Composition](#dom-composition-in-mint-js)
   - [Basic Usage](#basic-usage)
   - [Syntax Highlighting](#syntax-highlighting)
   - [Dynamic Content](#dynamic-content)
   - [Attributes and Properties](#attributes-and-properties)
   - [Reactive Contexts](#reactive-contexts)
   - [Conditional Rendering](#conditional-rendering)
   - [Event Handling](#event-handling)
   - [Controlled Inputs](#controlled-inputs)
   - [Components](#components)
   - [Children](#children)
   - [Array Rendering and Reactive Lists](#array-rendering-and-reactive-lists)
7. [Examples](#examples)
   - [Tic-Tac-Toe Game](#1-tic-tac-toe-game)
   - [Todo List with Filtering](#2-todo-list-with-filtering)
   - [Counter with Local Storage Persistence](#3-counter-with-local-storage-persistence)
8. [Status and Development](#status)

## Introduction

Mint-js is a lightweight, fine-grained reactive frontend library designed for efficient and flexible state management in web applications. It provides a simple yet powerful API for creating reactive user interfaces without the need for complex build processes or heavy framework dependencies.

## Installation

To install Mint-js, run the following command in your terminal:

```bash
npm i https://github.com/chaitanya-Uike/mint-js
```

# Core Concepts

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
11. [Array Rendering and Reactive Lists](#array-rendering-and-reactive-lists)

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

heres a simple timer example

```javascript
import { html, signal } from "mint-js";

const time = signal(0);

setInterval(() => time.set((t) => t + 1), 1000);

document.getElementById("app").appendChild(html`<h1>time: ${time}</h1>`);
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
but when using `store` properties you need to use functions to enable reactivity.

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

## Array Rendering and Reactive Lists

Mint-js provides powerful capabilities for rendering arrays of children and optimizing list rendering with the `reactiveMap` function.

### Basic Array Rendering

You can render an array of elements directly within the `html` template:

```javascript
const items = ["Apple", "Banana", "Cherry"];

const list = html`
  <ul>
    ${items.map((item) => html`<li>${item}</li>`)}
  </ul>
`;
```

### Optimized List Rendering with `reactiveMap`

The `reactiveMap` function provides an optimized way to render reactive lists. It efficiently updates only the parts of the list that have changed, rather than re-rendering the entire list. Importantly, `reactiveMap` uses referential equality to track changes, eliminating the need for explicit keys.

```javascript
import { html, store, reactiveMap } from "mint-js";

const todos = store([
  { id: 1, text: "Learn Mint-js", completed: false },
  { id: 2, text: "Build an app", completed: false },
]);

function TodoList() {
  return html`
    <ul>
      ${reactiveMap(
        todos,
        (todo) => html`
          <li>
            <input
              type="checkbox"
              checked=${todo.completed}
              onChange=${() => (todo.completed = !todo.completed)}
            />
            ${todo.text}
          </li>
        `
      )}
    </ul>
  `;
}
```

Key points about `reactiveMap`:

1. The first argument is the store or signal containing the array.
2. The second argument is a mapping function that returns the `html` template for each item.
3. `reactiveMap` uses referential equality to track changes, so you don't need to provide explicit keys.
4. It efficiently updates only the parts of the list that have changed.

### Signals vs Stores for Arrays

While signal arrays can be used for reactive lists, it's generally recommended to use store arrays instead. Store arrays provide fine-grained reactivity, which can lead to better performance and more predictable behavior in complex applications.

Benefits of using store arrays:

1. Fine-grained reactivity: Only the specific elements that change will trigger updates.
2. Direct mutations: You can directly modify properties of array elements without creating new objects.
3. Improved performance: Especially noticeable in large lists or complex data structures.

### Dynamic List Modifications

With store arrays, you can easily modify the list and the UI will update accordingly:

```javascript
const todos = store([
  { id: 1, text: "Learn Mint-js", completed: false },
  { id: 2, text: "Build an app", completed: false },
]);

function addTodo(text) {
  todos.push({ id: Date.now(), text, completed: false });
}

function removeTodo(id) {
  const index = todos.findIndex((todo) => todo.id === id);
  if (index !== -1) todos.splice(index, 1);
}

function TodoList() {
  return html`
    <ul>
      ${reactiveMap(
        todos,
        (todo) => html`
          <li>
            <input
              type="checkbox"
              checked=${todo.completed}
              onChange=${() => (todo.completed = !todo.completed)}
            />
            ${todo.text}
          </li>
        `
      )}
    </ul>
  `;
}
```

### Nested Reactive Lists

`reactiveMap` can also handle nested reactive lists efficiently:

```javascript
const categories = store([
  { id: 1, name: "Fruits", items: ["Apple", "Banana", "Cherry"] },
  { id: 2, name: "Vegetables", items: ["Carrot", "Broccoli", "Spinach"] },
]);

function CategoryList() {
  return html`
    <div>
      ${reactiveMap(
        categories,
        (category) => html`
          <div>
            <h2>${category.name}</h2>
            <ul>
              ${reactiveMap(
                () => category.items,
                (item) => html` <li>${item}</li> `
              )}
            </ul>
          </div>
        `
      )}
    </div>
  `;
}
```

In this example, both the categories and their items are reactively rendered without the need for explicit keys, benefiting from the fine-grained reactivity of stores.

### Performance Considerations

When working with large lists, consider the following tips:

1. Use store arrays for optimal fine-grained reactivity.
2. Utilize `reactiveMap` for efficient rendering of dynamic lists.
3. Leverage the referential equality feature of `reactiveMap` for efficient updates.
4. For very large lists, consider implementing pagination or virtual scrolling to render only visible items.
5. Avoid unnecessary re-renders by using memoization techniques for complex item rendering functions if needed.

By leveraging store arrays and `reactiveMap` for reactive lists, you can create efficient and performant list-based UIs in Mint-js without the need for explicit key management, while benefiting from fine-grained reactivity.

[... previous content remains the same ...]

## Examples

To help solidify your understanding of Mint-js and its features, here are some complete example components that demonstrate various aspects of the library.

### 1. Tic-Tac-Toe Game

This example showcases the use of stores, signals, and derived signals in a interactive game component.

```typescript
import { html, store, signal } from "mint-js";

type Player = "X" | "O" | null;
type Board = Player[];

export default function TicTacToe() {
  const board = store<Board>(Array(9).fill(null));
  const currentPlayer = signal<Player>("X");
  const gameStatus = signal<"playing" | "won" | "draw">("playing");

  const winningCombos = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  const winner = signal(() => {
    for (let combo of winningCombos) {
      const [a, b, c] = combo;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  });

  const isDraw = signal(
    () => board.every((cell) => cell !== null) && !winner()
  );

  const gameMessage = signal(() => {
    if (winner()) return `Player ${winner()} wins!`;
    if (isDraw()) return "It's a draw!";
    return `Current player: ${currentPlayer()}`;
  });

  function handleCellClick(index: number) {
    if (board[index] || gameStatus() !== "playing") return;

    board[index] = currentPlayer();

    if (winner()) {
      gameStatus.set("won");
    } else if (isDraw()) {
      gameStatus.set("draw");
    } else {
      currentPlayer.set(currentPlayer() === "X" ? "O" : "X");
    }
  }

  function resetGame() {
    for (let i = 0; i < 9; i++) {
      board[i] = null;
    }
    currentPlayer.set("X");
    gameStatus.set("playing");
  }

  return html`
    <div
      class="flex flex-col items-center justify-center min-h-screen bg-gray-100"
    >
      <h1 class="text-4xl font-bold mb-8 text-gray-800">Tic Tac Toe</h1>
      <div class="grid grid-cols-3 gap-2 mb-4">
        ${Array(9)
          .fill(null)
          .map(
            (_, index) => html`
              <button
                onClick=${() => handleCellClick(index)}
                class="w-20 h-20 bg-white text-4xl font-bold flex items-center justify-center border-2 border-gray-300 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                ${() => board[index]}
              </button>
            `
          )}
      </div>
      <div class="text-2xl font-semibold mb-4 text-gray-700">
        ${gameMessage}
      </div>
      <button
        onClick=${resetGame}
        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
      >
        Reset Game
      </button>
    </div>
  `;
}
```

This example demonstrates:

- Use of `store` for the game board
- Use of `signal` for game state
- Derived signals for winner and draw conditions
- Event handling with `onClick`
- Conditional rendering based on game state

### 2. Todo List with Filtering

This example shows how to create a todo list with filtering capabilities, demonstrating the use of stores, signals, and reactive rendering.

```typescript
import { html, store, signal, reactiveMap } from "mint-js";

type Todo = { id: number; text: string; completed: boolean };

export default function TodoList() {
  const todos = store<Todo[]>([]);
  const filter = signal<"all" | "active" | "completed">("all");

  const filteredTodos = signal(() => {
    switch (filter()) {
      case "active":
        return todos.filter((todo) => !todo.completed);
      case "completed":
        return todos.filter((todo) => todo.completed);
      default:
        return todos;
    }
  });

  function addTodo(text: string) {
    todos.push({ id: Date.now(), text, completed: false });
  }

  function toggleTodo(id: number) {
    const todo = todos.find((t) => t.id === id);
    if (todo) todo.completed = !todo.completed;
  }

  function removeTodo(id: number) {
    const index = todos.findIndex((t) => t.id === id);
    if (index !== -1) todos.splice(index, 1);
  }

  return html`
    <div class="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-xl">
      <h1 class="text-2xl font-bold mb-4">Todo List</h1>
      <input
        type="text"
        placeholder="Add new todo"
        onKeyPress=${(e: KeyboardEvent) => {
          if (e.key === "Enter") {
            addTodo((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).value = "";
          }
        }}
        class="w-full p-2 border rounded mb-4"
      />
      <div class="mb-4">
        <button
          onClick=${() => filter.set("all")}
          class="mr-2 px-2 py-1 bg-blue-500 text-white rounded"
        >
          All
        </button>
        <button
          onClick=${() => filter.set("active")}
          class="mr-2 px-2 py-1 bg-green-500 text-white rounded"
        >
          Active
        </button>
        <button
          onClick=${() => filter.set("completed")}
          class="px-2 py-1 bg-red-500 text-white rounded"
        >
          Completed
        </button>
      </div>
      <ul>
        ${reactiveMap(
          filteredTodos,
          (todo) => html`
            <li class="flex items-center justify-between mb-2">
              <span class=${() => (todo.completed ? "line-through" : "")}>
                ${todo.text}
              </span>
              <div>
                <button
                  onClick=${() => toggleTodo(todo.id)}
                  class="mr-2 px-2 py-1 bg-yellow-500 text-white rounded"
                >
                  Toggle
                </button>
                <button
                  onClick=${() => removeTodo(todo.id)}
                  class="px-2 py-1 bg-red-500 text-white rounded"
                >
                  Delete
                </button>
              </div>
            </li>
          `
        )}
      </ul>
    </div>
  `;
}
```

This example demonstrates:

- Use of `store` for the todo list
- Use of `signal` for filtering
- Derived signal for filtered todos
- Event handling for adding, toggling, and removing todos
- Use of `reactiveMap` for efficient list rendering

### 3. Counter with Local Storage Persistence

This example shows how to create a simple counter that persists its state in local storage, demonstrating the use of effects and signals.

```typescript
import { html, signal, effect } from "mint-js";

export default function PersistentCounter() {
  const count = signal(parseInt(localStorage.getItem("count") || "0"));

  effect(() => {
    localStorage.setItem("count", count().toString());
  });

  return html`
    <div class="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 class="text-4xl font-bold mb-4">Persistent Counter</h1>
      <p class="text-2xl mb-4">Count: ${count}</p>
      <div>
        <button
          onClick=${() => count.set((c) => c - 1)}
          class="px-4 py-2 bg-red-500 text-white rounded mr-2"
        >
          Decrease
        </button>
        <button
          onClick=${() => count.set((c) => c + 1)}
          class="px-4 py-2 bg-green-500 text-white rounded"
        >
          Increase
        </button>
      </div>
    </div>
  `;
}
```

This example demonstrates:

- Use of `signal` for state management
- Use of `effect` for side effects (local storage persistence)
- Event handling for increasing and decreasing the counter

These examples showcase different aspects of Mint-js, including state management with stores and signals, derived signals, reactive rendering, event handling, and side effects. They provide a practical demonstration of how these concepts come together to create interactive and efficient web applications.

## Status and Development

Mint-js is currently under active development. While the library is evolving, the core API mentioned in
the doc will largely remain the same. Mint-js serves as an excellent tool for learning about reactive programming and modern frontend development

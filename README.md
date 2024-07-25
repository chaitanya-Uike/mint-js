# mint-js

Mint is a lightweight, fine-grained reactive frontend library for building user interfaces.

## Installation

Install mint-js using npm:

```bash
npm i https://github.com/chaitanya-Uike/mint-js
```

## Core Concepts

1. **Signals**: Fundamental units of reactivity
2. **Effects**: Perform side effects in response to signal changes
3. **DOM Composition**: Create and manipulate DOM elements

### Signals

Signals store and return a value, and can be updated using their `set` method.

```javascript
import { signal } from "mint-js";

const count = signal(0);
console.log(count()); // 0
count.set(5);
console.log(count()); // 5

const a = signal(1);
const b = signal(() => a() * 2); // b now tracks a

console.log(b()); // 2
a.set((prevVal) => prevVal + 4);
console.log(b()); // 10
```

### Effects

Effects perform side effects in response to signal changes.

```javascript
import { createEffect } from "mint-js";

const count = signal(0);

createEffect(() => {
  console.log(`The count is now ${count()}`);
});

// Cleanup function example
const visible = signal(true);

createEffect(() => {
  if (visible()) {
    const timer = setInterval(() => {
      console.log("Tick");
    }, 1000);

    return () => clearInterval(timer);
  }
});
```

### DOM Composition

Create DOM elements using the `tags` object.

```javascript
import { tags, signal } from "mint-js";

const count = signal(0);

const counter = tags.div(
  tags.button({ onClick: () => count.set(count() - 1) }, "-"),
  count,
  tags.button({ onClick: () => count.set(count() + 1) }, "+")
);
```

## Components

Create reusable components using the `Component` function.

```javascript
import { Component, signal, tags } from "mint-js";

const Counter = Component((initialCount = 0) => {
  const count = signal(initialCount);

  return tags.div(
    tags.button({ onClick: () => count.set((c) => c - 1) }, "-"),
    () => `count: ${count()}`,
    tags.button({ onClick: () => count.set((c) => c + 1) }, "+")
  );
});

const App = Component(() => {
  return tags.div(
    Counter(5)
    // ...other children
  );
});

document.getElementById("app").appendChild(App());
```

## Advanced Usage

### Reactive Props and Conditional Rendering

```javascript
import { signal, tags } from "mint-js";

const count = signal(0);
const isEven = () => count() % 2 === 0;

const counter = tags.div(
  {
    style: { color: () => (isEven() ? "blue" : "red") },
  },
  tags.button({ onClick: () => count.set((c) => c - 1) }, "-"),
  count,
  tags.button({ onClick: () => count.set((c) => c + 1) }, "+"),
  () => (isEven() ? tags.span("Even") : tags.span("Odd"))
);
```

### Signal Bindings

```javascript
const name = signal("John");

tags.input({
  onInput: (e) => name.set(e.target.value),
  value: name,
});
```

## Examples

### Timer

```javascript
import { Component, signal, tags, createEffect } from "mint-js";

const Timer = Component(() => {
  const time = signal(0);

  createEffect(() => {
    const interval = setInterval(() => time.set((t) => t + 1), 1000);
    return () => clearInterval(interval);
  });

  return tags.div("Time elapsed: ", () => `${time()} seconds`);
});

document.getElementById("app").appendChild(Timer());
```

### Todo List

mint-js includes full TypeScript support out of the box.

```typescript
import { Component, signal, tags, createEffect } from "mint-js";

interface Todo {
  id: number;
  content: string;
  done: boolean;
}

const TodoList = Component(() => {
  const todos = signal<Todo[]>(
    JSON.parse(localStorage.getItem("appState") ?? "[]")
  );

  createEffect(() => localStorage.setItem("appState", JSON.stringify(todos())));

  const input = tags.input({
    className: "flex-grow mr-2 p-2 border rounded",
    placeholder: "Add a new todo",
    onKeyPress: (e: KeyboardEvent) => {
      if (e.key === "Enter") addTodo();
    },
  }) as HTMLInputElement;

  const addTodo = () => {
    const val = input.value.trim();
    if (val.length) {
      todos.set([...todos(), { id: Date.now(), content: val, done: false }]);
    }
    input.value = "";
  };

  const toggleTodo = (id: number) => {
    todos.set(
      todos().map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    );
  };

  const removeTodo = (id: number) => {
    todos.set(todos().filter((todo) => todo.id !== id));
  };

  return tags.div(
    { className: "max-w-md mx-auto mt-8 p-4 bg-white rounded shadow" },
    tags.h1({ className: "text-2xl font-bold mb-4" }, "Todo List"),
    tags.div(
      { className: "flex mb-4" },
      input,
      tags.button(
        {
          className:
            "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600",
          onClick: addTodo,
        },
        "Add"
      )
    ),
    tags.ul({ className: "space-y-2" }, () =>
      todos().map((todo) =>
        tags.li(
          { key: todo.id, className: "flex items-center" },
          tags.input({
            type: "checkbox",
            checked: todo.done,
            onChange: () => toggleTodo(todo.id),
            className: "mr-2",
          }),
          tags.span(
            {
              className: () =>
                `flex-grow ${todo.done ? "line-through text-gray-500" : ""}`,
            },
            todo.content
          ),
          tags.button(
            {
              className:
                "px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 ml-2",
              onClick: () => removeTodo(todo.id),
            },
            "Remove"
          )
        )
      )
    )
  );
});

document.getElementById("app").appendChild(TodoList());
```

### Dynamic Styling

```javascript
import { Component, signal, tags } from "mint-js";

const DynamicStyle = Component(() => {
  const hue = signal(0);

  setInterval(() => {
    hue.set((h) => (h + 1) % 360);
  }, 20);

  return tags.div(
    {
      style: {
        backgroundColor: () => `hsl(${hue()}, 100%, 50%)`,
        width: "100px",
        height: "100px",
        transition: "background-color 0.1s",
      },
    },
    "Color changing box"
  );
});

document.getElementById("app").appendChild(DynamicStyle());
```

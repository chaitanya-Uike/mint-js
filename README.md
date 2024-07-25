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

Effects are used to perform side effects in response to signal changes. Effects track all the signals accessed during their run and re-run only when their dependencies update. You can create effects using the `createEffect` function.

```javascript
import { createEffect } from "mint-js";

createEffect(() => {
  console.log(`The count is now ${count()}`);
});
```

`createEffect` invokes the given function each time any of the signals that are read inside are updated. The effect is immediately invoked on initialization.

You can optionally return a function from inside the effect that will be run each time the effect re-runs and when it's finally stopped/disposed of:

```javascript
createEffect(() => {
  // Effect logic here
  return () => {
    // Cleanup logic here
    // Called each time effect re-runs and when disposed of
  };
});
```

### Examples

#### Interval Timer

```javascript
const visible = signal(true);

createEffect(() => {
  if (visible()) {
    const timer = setInterval(() => {
      console.log("Tick");
    }, 1000);

    return () => clearInterval(timer); // This cleanup function will be called when visible becomes false
  }
});
```

#### Local Storage Sync

```javascript
const todos = signal(JSON.parse(localStorage.getItem("todos") || "[]"));

createEffect(() => {
  localStorage.setItem("todos", JSON.stringify(todos()));
});
```

## DOM Composition

### Tags

The `tags` object in Mint-js provides a convenient way to create DOM elements using JavaScript. Each property of the `tags` object is a function that creates an HTML element of the corresponding type.

```javascript
import { tags } from "mint-js";

const div = tags.div("Hello, world!");
const button = tags.button({ onClick: () => alert("Clicked!") }, "Click me");
```

The `tags` functions can accept multiple arguments:

- An optional props object as the first argument
- Any number of child elements or text content

Here's a more complex example:

```javascript
const form = tags.form(
  { onSubmit: (e) => e.preventDefault() },
  tags.label({ htmlFor: "name" }, "Name:"),
  tags.input({ id: "name", type: "text" }),
  tags.button({ type: "submit" }, "Submit")
);
```

The `tags` object supports all standard HTML elements.

You can also use signals and functions as children to create dynamic content:

```javascript
import { signal, tags } from "mint-js";

const count = signal(0);

const counter = tags.div(
  tags.button({ onClick: () => count.set(count() - 1) }, "-"),
  count, // This will update whenever count changes
  tags.button({ onClick: () => count.set(count() + 1) }, "+")
);
```

Note: You don't need to call the signal getter when using it as a child.

When using the `tags` object, Mint-js takes care of efficiently updating the DOM when your signals change, allowing you to create dynamic and reactive user interfaces with ease.

### Advanced Usage

The `tags` functions can create reactive contexts in both props and children by using functions:

```javascript
import { signal, tags } from "mint-js";

const count = signal(0);
const isEven = signal(() => count() % 2 === 0);

const counter = tags.div(
  {
    style: { color: () => (isEven() ? "blue" : "red") }, // Reactive prop
  },
  tags.button({ onClick: () => count.set((c) => c - 1) }, "-"),
  count, // Reactive child
  tags.button({ onClick: () => count.set((c) => c + 1) }, "+"),
  () => (isEven() ? tags.span("Even") : tags.span("Odd")) // Conditional rendering
);
```

In this example, the `style` prop and the count display will update reactively whenever `count` changes. The last child element demonstrates conditional rendering based on a derived value.

```javascript
const isDisabled = signal(false);

const button = tags.button(
  {
    onClick: () => console.log("Clicked!"),
    disabled: isDisabled,
  },
  "Click me"
);

// Later, you can update the disabled state:
isDisabled.set(true);
```

### Signal Bindings

```javascript
const name = signal("john");

tags.input({
  onInput: (e) => name.set(e.target.value),
  value: name,
});
```

## Modularity and Composition

### Components

Components in Mint-js are functions that return DOM elements. They can be created using the `Component` function. Components handle cleanup of all child signals and effects. So you can safely pass signals as props from parent components.

```javascript
import { Component, tags } from "mint-js";

function Greeting(name) {
  return tags.h1(`Hello, ${name()}!`);
}

export default Component(Greeting);
```

### Advanced Usage

Components can use signals internally for local state, and can also accept signals as props for dynamic updates:

```javascript
const Counter = Component((initialCount = 0) => {
  const count = signal(initialCount);

  return tags.div(
    tags.button({ onClick: () => count.set((c) => c - 1) }, "-"),
    () => `count: ${count()}`,
    tags.button({ onClick: () => count.set((c) => c + 1) }, "+")
  );
});

const Greet = Component((firstName, lastName) => {
  const fullName = signal(() => `${firstName()} ${lastName()}`);
  return tags.h1(() => `Hello! ${fullName()}`);
});

const App = Component(() => {
  const firstName = signal("john");
  const lastName = signal("doe");

  return tags.div(
    Counter(5),
    Greet(firstName, lastName)
    //other children
  );
});

// tags returns HTML elements
document.getElementById("app").appendChild(App());
```

## Examples

### Counter

```javascript
import { Component, signal, tags } from "mint-js";

const Counter = Component(() => {
  const count = signal(0);
  return tags.div(
    tags.button({ onClick: () => count.set((c) => c - 1) }, "-"),
    count,
    tags.button({ onClick: () => count.set((c) => c + 1) }, "+")
  );
});
```

### Timer

```javascript
import { Component, signal, tags, createEffect } from "mint-js";

const Timer = Component(() => {
  const time = signal(0);

  setInterval(() => time.set((t) => t + 1), 1000);

  return tags.div("Time elapsed: ", () => `${time()} seconds`);
});
```

### Advanced Component Composition

This example demonstrates how to compose multiple components with signals, conditional rendering, and dynamic styling:

```typescript
import { Component, Signal, signal, tags } from "mint-js";

const Counter = Component(() => {
  const count = signal(0);
  return tags.div(
    { className: "flex items-center space-x-4" },
    tags.button(
      {
        onClick: () => count.set((c) => c + 1),
        className:
          "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition",
      },
      "+"
    ),
    tags.p({ className: "text-lg font-semibold" }, () => `Count: ${count()}`),
    tags.button(
      {
        onClick: () => count.set((c) => c - 1),
        className:
          "px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition",
      },
      "-"
    )
  );
});

const Timer = Component(() => {
  const time = signal(0);
  setInterval(() => time.set((t) => ++t), 1000);
  return tags.h1({ className: "text-3xl font-bold text-gray-700" }, time);
});

const Greet = Component(
  (
    firstName: Signal<string>,
    lastName: Signal<string>,
    toggle: Signal<boolean>
  ) => {
    const fullName = signal(() => `${firstName()} ${lastName()}`);
    return tags.h1(
      {
        className: "text-2xl font-bold mb-4",
        style: { color: () => (toggle() ? "red" : "blue") },
      },
      () => `Hello! ${fullName()}`
    );
  }
);

const NameForm = Component(
  (firstName: Signal<string>, lastName: Signal<string>) => {
    return tags.div(
      { className: "flex space-x-4 mb-4" },
      tags.input({
        onInput: (e: Event) =>
          firstName.set((e.target as HTMLInputElement).value),
        value: firstName,
        className:
          "border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500",
      }),
      tags.input({
        onInput: (e: Event) =>
          lastName.set((e.target as HTMLInputElement).value),
        value: lastName,
        className:
          "border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500",
      })
    );
  }
);

const App = Component(() => {
  const showForm = signal(false);
  const firstName = signal("John");
  const lastName = signal("Doe");

  return tags.div(
    { className: "flex flex-col container mx-auto p-6 max-w-md items-center" },
    Greet(firstName, lastName, showForm),
    tags.button(
      {
        onClick: () => showForm.set(!showForm()),
        className:
          "mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition",
      },
      () => (showForm() ? "Hide" : "Show")
    ),
    tags.div({ className: "mb-4" }, Timer()),
    tags.div({ className: "mb-4" }, Counter()),
    () => (showForm() ? NameForm(firstName, lastName) : null)
  );
});

export default App;
```

### Todo List

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

  createEffect(() => {
    const interval = setInterval(() => {
      hue.set((h) => (h + 1) % 360);
    }, 20);
    return () => clearInterval(interval);
  });

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
```

import { effect, signal, flush } from "../src";

afterEach(() => flush());

it("should batch updates", () => {
  const a = signal(10);
  const effectFn = jest.fn(() => void a());

  effect(effectFn);

  a.set(20);
  a.set(30);
  a.set(40);

  expect(effectFn).toHaveBeenCalledTimes(1);
  flush();
  expect(effectFn).toHaveBeenCalledTimes(2);
});

it("should wait for queue to flush", () => {
  const a = signal(10);
  const effectFn = jest.fn(() => void a());

  effect(effectFn);

  expect(effectFn).toHaveBeenCalledTimes(1);

  a.set(20);
  flush();
  expect(effectFn).toHaveBeenCalledTimes(2);

  a.set(30);
  flush();
  expect(effectFn).toHaveBeenCalledTimes(3);
});

it("should not fail if called while flushing", () => {
  const a = signal(10);
  const effectFn = jest.fn(() => {
    a();
    flush();
  });

  effect(() => {
    effectFn();
  });

  expect(effectFn).toHaveBeenCalledTimes(1);

  a.set(20);
  flush();
  expect(effectFn).toHaveBeenCalledTimes(2);
});

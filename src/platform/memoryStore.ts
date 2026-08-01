export class ClonedValueStore<T> {
  constructor(private value: T) {}

  read() {
    return structuredClone(this.value);
  }

  write(value: T) {
    this.value = structuredClone(value);
  }
}

export class ClonedMapStore<T> {
  readonly #values = new Map<string, T>();

  constructor(initial: readonly T[], key: (value: T) => string) {
    for (const value of initial)
      this.#values.set(key(value), structuredClone(value));
  }

  list() {
    return [...this.#values.values()].map((value) => structuredClone(value));
  }

  get(key: string) {
    const value = this.#values.get(key);
    return value === undefined ? null : structuredClone(value);
  }

  set(key: string, value: T) {
    this.#values.set(key, structuredClone(value));
  }

  delete(key: string) {
    this.#values.delete(key);
  }
}

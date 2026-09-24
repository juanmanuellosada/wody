type Snapshot = { ok: true; value: unknown } | { ok: false };

const FAILURE: Snapshot = Object.freeze({ ok: false });

/** A descriptor map is private capture data, so its keys can be inspected safely. */
function capturesExactly(keys: readonly (string | symbol)[], descriptors: object): boolean {
  const capturedKeys = Reflect.ownKeys(descriptors);
  return keys.length === capturedKeys.length && keys.every((key) => capturedKeys.includes(key));
}

/**
 * Captures enumerable data descriptors into an owned ordinary graph. It never
 * reads source properties or toJSON, and rejects symbols, accessors, custom
 * prototypes, sparse arrays, cycles, and reflection failures. Transparent
 * proxies cannot be universally detected; only this coherent capture is
 * admitted before detached validation and JSON serialization.
 */
export function snapshotDemoStorageValue(value: unknown, ancestors = new WeakSet<object>()): Snapshot {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return { ok: true, value };
  if (typeof value !== "object") return FAILURE;
  try {
    if (ancestors.has(value)) return FAILURE;
    ancestors.add(value);
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return FAILURE;
      const keys = Reflect.ownKeys(value);
      const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(value as object);
      if (!capturesExactly(keys, descriptors)) return FAILURE;
      const length = descriptors.length;
      if (!length || !("value" in length) || typeof length.value !== "number" || !Number.isSafeInteger(length.value) || length.value < 0 || length.enumerable) return FAILURE;
      const lengthValue = length.value;
      if (keys.length !== lengthValue + 1 || !keys.every((key) => key === "length" || (typeof key === "string" && /^(0|[1-9]\d*)$/.test(key) && Number(key) < lengthValue))) return FAILURE;
      const copy: unknown[] = [];
      for (let index = 0; index < lengthValue; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return FAILURE;
        const nested = snapshotDemoStorageValue(descriptor.value, ancestors);
        if (!nested.ok) return FAILURE;
        copy.push(nested.value);
      }
      return { ok: true, value: copy };
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) return FAILURE;
    const keys = Reflect.ownKeys(value);
    const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(value);
    if (!capturesExactly(keys, descriptors) || keys.some((key) => typeof key !== "string")) return FAILURE;
    const copy: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = descriptors[key as string];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return FAILURE;
      const nested = snapshotDemoStorageValue(descriptor.value, ancestors);
      if (!nested.ok) return FAILURE;
      Object.defineProperty(copy, key, { value: nested.value, enumerable: true, configurable: true, writable: true });
    }
    return { ok: true, value: copy };
  } catch {
    return FAILURE;
  } finally {
    try { ancestors.delete(value); } catch { /* reflection/proxy failure remains invalid */ }
  }
}

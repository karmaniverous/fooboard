/**
 * Get-or-create for keyed caches (a `Map` or `WeakMap`): the value cached
 * under a key, built once on first use.
 *
 * @module
 */

/** What `getOrCreate` needs of a cache. */
interface KeyedCache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): unknown;
}

/** `cache`'s value for `key`, built by `create` and cached on first use. */
export function getOrCreate<K, V>(
  cache: KeyedCache<K, V>,
  key: K,
  create: () => V,
): V {
  let value = cache.get(key);
  if (value === undefined) {
    value = create();
    cache.set(key, value);
  }
  return value;
}

const KEY_PATH_DELIMITER = ":";
const NULLISH = [undefined, null];

function exists(obj) {
  return !NULLISH.includes(obj);
}

function compare(a, b) {
  if (a === b) {
    return 0;
  }

  // Give precedence to value deletions
  if (!exists(a)) {
    return 1;
  } else if (!exists(b)) {
    return -1;
  }

  // Offload the comparison algorithm
  const ordered = [a, b].sort();

  if (ordered[0] === a) {
    return 1;
  } else {
    return -1;
  }
}

// Reduces the set to only include latest updates
function compress(set) {
  const latestUpdates = {};

  for (const e of set) {
    const { key, timestamp } = e;

    if (latestUpdates[key] && latestUpdates[key].timestamp === timestamp) {
      // Break the tie
      const { value: valueA } = latestUpdates[key];
      const { value: valueB } = e;

      // Design choice: resolve competing updates by looking at the value.
      if (compare(valueA, valueB) >= 0) {
        // Existing update wins. Drop the new value
        continue;
      } else {
        // New update wins. Replace the previous update.
        latestUpdates[key] = e;
      }
    } else if (
      !latestUpdates[key] ||
      latestUpdates[key].timestamp < timestamp
    ) {
      latestUpdates[key] = e;
    }
  }

  return Object.values(latestUpdates);
}

function merge(setA, setB) {
  return compress([...setA, ...setB]);
}

function deepSet(baseObject, key, value) {
  if (!exists(baseObject)) {
    throw new Error(`Cannot invoke deepSet on undefined object`);
  }

  const nextDelim = key.indexOf(KEY_PATH_DELIMITER);
  if (nextDelim < 0) {
    // Base case: update the value
    baseObject[key] = value;
    return;
  }

  const currentKey = key.substring(0, nextDelim);
  const remainingKey = key.substring(nextDelim + 1);

  // Special case - ignore leading delimiters. This effectively treats double-delimiters (or any repetition) as a single delimiter.
  if (currentKey === "") {
    deepSet(baseObject, remainingKey, value);
    return;
  }

  // This can have the uninteded consequence of creating an object when a sub-value is cleared. This is not considered a bug.
  if (!exists(baseObject[currentKey])) {
    baseObject[currentKey] = {};
  }
  deepSet(baseObject[currentKey], remainingKey, value);
  return;
}

function asObject(set) {
  const compressed = compress(set);
  const result = {};

  for (const { key, value } of compressed) {
    deepSet(result, key, value);
  }

  return result;
}

module.exports = {
  merge,
  asObject,
};

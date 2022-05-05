function compare(a, b) {
  if (a === b) {
    return 0;
  }

  // Give precedence to value deletions
  if ([undefined, null].includes(a)) {
    return 1;
  } else if ([undefined, null].includes(b)) {
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

function asObject(set) {
  const compressed = compress(set);
  const result = {};

  for (const { key, value } of compressed) {
    result[key] = value;
  }

  return result;
}

module.exports = {
  merge,
  asObject,
};

// Removes outdated elements
function compress(set) {
  const latestUpdates = {};

  for (const e of set) {
    const { key, timestamp } = e;

    if (!latestUpdates[key] || latestUpdates[key].timestamp < timestamp) {
      latestUpdates[key] = e;
    }
  }

  return Object.values(latestUpdates);
}

function merge(setA, setB) {
  // Create the result set, consisting of all elements in setA
  const result = [...setA];

  // Add every element from setB for which there is no element in the result with a.key === b.key and a.timestamp >= b.timestamp
  const latestUpdates = result.reduce((acc, { key, timestamp }) => {
    if (!acc[key] || acc[key] < timestamp) {
      acc[key] = timestamp;
    }
    return acc;
  }, {});

  for (const e of setB) {
    const { key, timestamp } = e;

    if (!latestUpdates[key] || latestUpdates[key] < timestamp) {
      result.push(e);
      latestUpdates[key] = timestamp;
    }
  }

  return compress(result);
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

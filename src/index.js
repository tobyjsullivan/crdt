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

  return result;
}

function asObject(set) {
  const result = {
    __meta__: {
      latestUpdates: {},
    },
  };

  for (const { key, value, timestamp } of set) {
    const latest = result.__meta__.latestUpdates[key];

    if (!latest || latest < timestamp) {
      result[key] = value;
      result.__meta__.latestUpdates[key] = timestamp;
    }
  }

  return result;
}

module.exports = {
  merge,
  asObject,
};

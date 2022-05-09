const VALUE_TYPE_VALUE = "VALUE";
const VALUE_TYPE_NODE_REF = "NODE_REF";

const ROOT_NODE_ID = "root";

// Produces an empty document
function emptyDocument() {
  return [];
}

// Comparison is used to break ties on simultaneous updates.
// The exact rules are largely meaningless as long as they are consistent.
// That said, some specific cases are favourable:
// - Favour value deletions to avoid recreating phantom objects when an edit ties with a delete.
function compare(valueA, valueB) {
  if (valueA === valueB) {
    // Shouldn't happen but might as well handle it.
    return 0;
  }

  // Give precedence to value deletions
  if (
    valueA.type === VALUE_TYPE_VALUE &&
    [undefined, null].includes(valueA.value)
  ) {
    return 1;
  }
  if (
    valueB.type === VALUE_TYPE_VALUE &&
    [undefined, null].includes(valueB.value)
  ) {
    return -1;
  }

  // Favour node refs. There's no particular reason for this preference.
  if (valueA.type === VALUE_TYPE_NODE_REF && valueB.type === VALUE_TYPE_VALUE) {
    return 1;
  }
  if (valueB.type === VALUE_TYPE_NODE_REF && valueA.type === VALUE_TYPE_VALUE) {
    return -1;
  }

  let comparisonA, comparisonB;
  if (valueA.type === VALUE_TYPE_NODE_REF) {
    // Both are node refs
    comparisonA = valueA.nodeRef;
    comparisonB = valueB.nodeRef;
  } else {
    // Both are values
    comparisonA = valueA.value;
    comparisonB = valueB.value;
  }

  // Offload the comparison algorithm to the default sort order which casts the values to strings and compares them.
  const ordered = [comparisonA, comparisonB].sort();
  if (ordered[0] === comparisonA) {
    return 1;
  } else {
    return -1;
  }
}

// Reduces the set to only include latest updates
function compress(document) {
  const latestUpdatesByNode = {};

  for (const currentUpdate of document) {
    const { nodeId, key, timestamp } = currentUpdate;

    if (!latestUpdatesByNode[nodeId]) {
      latestUpdatesByNode[nodeId] = {};
    }
    const latestUpdate = latestUpdatesByNode[nodeId][key];

    if (latestUpdate && latestUpdate.timestamp === timestamp) {
      // Break the tie
      const { value: valueA } = latestUpdate;
      const { value: valueB } = currentUpdate;

      // Design choice: resolve competing updates by looking at the value.
      if (compare(valueA, valueB) < 0) {
        // New update wins. Replace the previous update.
        latestUpdatesByNode[nodeId][key] = currentUpdate;
      }
    } else if (!latestUpdate || latestUpdate.timestamp < timestamp) {
      latestUpdatesByNode[nodeId][key] = currentUpdate;
    }
  }

  return Object.values(latestUpdatesByNode) //
    .flatMap((latestUpdates) => Object.values(latestUpdates));
}

function merge(documentA, documentB) {
  return compress([...documentA, ...documentB]);
}

function buildNodeIdMap(document) {
  const nodeIdMap = {
    [ROOT_NODE_ID]: {},
  };

  for (const {
    nodeId,
    key,
    value: { type, nodeRef },
  } of compressed) {
    if (!nodeIdMap[nodeId]) {
      nodeIdMap[nodeId] = {};
    }

    if (type === VALUE_TYPE_NODE_REF) {
      nodeIdMap[nodeId][key] = nodeRef;
    }
  }

  return nodeIdMap;
}

function getNodeId(document, keyPath) {
  if (keyPath.length === 0) {
    return ROOT_NODE_ID;
  }

  const compressed = compress(document);
  const nodeIdMap = buildNodeIdMap(compressed);

  let nodeId = ROOT_NODE_ID;
  for (const key of keyPath) {
    nodeId = nodeIdMap[nodeId][key];

    if (nodeId === undefined) {
      return undefined;
    }
  }

  return nodeId;
}

function getNodeKeys(document, keyPath) {
  const compressed = compress(document);
  const nodeId = getNodeId(compressed, keyPath);

  const keys = {};
  for (const update of compressed) {
    if (update.nodeId !== nodeId) {
      continue;
    }

    if (update.value === undefined) {
      // Exclude deleted keys
      continue;
    }

    keys[update.key] = update.value;
  }

  return Object.keys(keys);
}

function asObject(document) {
  const compressed = compress(document);
  const nodes = {};

  for (const {
    nodeId,
    key,
    value: { type, value, nodeRef },
  } of compressed) {
    const node = nodes[nodeId] || {};

    switch (type) {
      case VALUE_TYPE_VALUE: {
        node[key] = value;
        break;
      }
      case VALUE_TYPE_NODE_REF: {
        if (!nodes[nodeRef]) {
          nodes[nodeRef] = {};
        }

        // It's currently possible for multiple properties to point to the same object. This should be considered a bug but it's not obvious where the fix should go.
        const target = nodes[nodeRef];
        node[key] = target;
      }
    }

    nodes[nodeId] = node;
  }

  return nodes[ROOT_NODE_ID] || {};
}

module.exports = {
  emptyDocument,
  merge,
  getNodeId,
  getNodeKeys,
  asObject,
};

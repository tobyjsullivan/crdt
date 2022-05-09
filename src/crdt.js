const VALUE_TYPE_ATOM = "ATOM";
const VALUE_TYPE_NODE_REF = "NODE_REF";

const NODE_ID_ROOT = "root";

function atomValue(value) {
  return {
    type: VALUE_TYPE_ATOM,
    value,
  };
}

function nodeRefValue(nodeId) {
  return {
    type: VALUE_TYPE_NODE_REF,
    nodeRef: nodeId,
  };
}

function updateValue(nodeId, key, value, timestamp) {
  return {
    nodeId,
    key,
    timestamp,
    value: atomValue(value),
  };
}

function updateNodeRef(nodeId, key, nodeRef, timestamp) {
  return {
    nodeId,
    key,
    timestamp,
    value: nodeRefValue(nodeRef),
  };
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
    valueA.type === VALUE_TYPE_ATOM &&
    [undefined, null].includes(valueA.value)
  ) {
    return 1;
  }
  if (
    valueB.type === VALUE_TYPE_ATOM &&
    [undefined, null].includes(valueB.value)
  ) {
    return -1;
  }

  // Favour node refs. There's no particular reason for this preference.
  if (valueA.type === VALUE_TYPE_NODE_REF && valueB.type === VALUE_TYPE_ATOM) {
    return 1;
  }
  if (valueB.type === VALUE_TYPE_NODE_REF && valueA.type === VALUE_TYPE_ATOM) {
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
      case VALUE_TYPE_ATOM: {
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

  return nodes[NODE_ID_ROOT] || {};
}

module.exports = {
  VALUE_TYPE_ATOM,
  VALUE_TYPE_NODE_REF,
  NODE_ID_ROOT,
  compress,
  merge,
  asObject,
  updateValue,
  updateNodeRef,
};

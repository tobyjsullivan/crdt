const { v4: uuidV4 } = require("uuid");
const {
  compress,
  updateNodeRef,
  updateValue,
  VALUE_TYPE_ATOM,
  VALUE_TYPE_NODE_REF,
  NODE_ID_ROOT,
} = require("./crdt");

function buildNodeIdMap(document) {
  const compressed = compress(document);
  const nodeIdMap = {
    [NODE_ID_ROOT]: {},
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

function parseKeyPath(key) {
  return key.split(".").filter((part) => part.length !== 0);
}

class Node {
  constructor(document, nodeId) {
    this.document = document;
    this.nodeId = nodeId;
  }

  get(key) {
    return this.document.getRelativeToNode(this.nodeId, key);
  }

  set(key, value, timestamp) {
    this.document.setRelativeToNode(this.nodeId, key, value, timestamp);
  }
}

class Document {
  constructor(state = []) {
    this.state = state;
  }

  get(key) {
    return this.getRelativeToNode(NODE_ID_ROOT, key);
  }

  getRelativeToNode(startingNodeId, key) {
    const keyPath = parseKeyPath(key);
    if (keyPath.length === 0) {
      throw new Error(`Invalid key: '${key}'`);
    }

    const ancestorKeyParts = keyPath.slice(0, -1);
    const lastKeyPart = keyPath[keyPath.length - 1];

    const nodeIdMap = buildNodeIdMap(this.state);

    let nodeId = startingNodeId;
    for (const curPart of ancestorKeyParts) {
      nodeId = nodeIdMap[nodeId][curPart];

      if (nodeId === undefined) {
        return undefined;
      }
    }

    const compressed = compress(this.state);
    for (const update of compressed) {
      const { nodeId: currentNodeId, key: currentKey } = update;

      if (currentNodeId !== nodeId || currentKey !== lastKeyPart) {
        continue;
      }

      const { type, value, nodeRef } = update.value;

      switch (type) {
        case VALUE_TYPE_ATOM: {
          return value;
        }
        case VALUE_TYPE_NODE_REF: {
          return new Node(this, nodeRef);
        }
        default: {
          throw new Error(`Unknown value type: '${type}'`);
        }
      }
    }

    return undefined;
  }

  set(key, value, timestamp) {
    this.setRelativeToNode(NODE_ID_ROOT, key, value, timestamp);
  }

  setRelativeToNode(startingNodeId, key, value, timestamp) {
    const keyPath = parseKeyPath(key);
    if (keyPath.length === 0) {
      throw new Error(`Invalid key: '${key}'`);
    }

    const ancestorKeyParts = keyPath.slice(0, -1);
    const lastKeyPart = keyPath[keyPath.length - 1];

    const nodeIdMap = buildNodeIdMap(this.state);

    const updates = [];

    let nodeId = startingNodeId;
    for (const curPart of ancestorKeyParts) {
      const prevNodeId = nodeId;
      nodeId = nodeIdMap[nodeId][curPart];

      if (nodeId === undefined) {
        nodeId = uuidV4();
        updates.push(updateNodeRef(prevNodeId, curPart, nodeId, timestamp));
      }
    }

    updates.push(updateValue(nodeId, lastKeyPart, value, timestamp));

    this.state.push(...updates);
  }

  keys(nodeKey = "") {
    return this.keysRelativeToNode(NODE_ID_ROOT, nodeKey);
  }

  keysRelativeToNode(startingNodeId, nodeKey) {
    const keyPath = parseKeyPath(nodeKey);

    const nodeIdMap = buildNodeIdMap(this.state);

    let nodeId = startingNodeId;
    for (const curPart of keyPath) {
      nodeId = nodeIdMap[nodeId][curPart];

      if (nodeId === undefined) {
        return undefined;
      }
    }

    // TODO: Avoid duplicate compression with buildNodeIdMap
    const compressed = compress(this.state);

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
}

function createDocument() {
  return new Document();
}

module.exports = {
  createDocument,
};

const { io } = require("socket.io-client");
const { v4: uuidV4 } = require("uuid");
const { getTime, updateTime } = require("./clock");
const { asObject, getNodeId, merge } = require("./crdt");

const EVENT_SYNC_CLOCK = "sync-clock";
const EVENT_POST_UPDATES = "post-updates";
const EVENT_BROADCAST_UPDATE = "broadcast-update";
const EVENT_REQUEST_DOCUMENT = "request-document";
const EVENT_DOCUMENT = "document";

const VALUE_TYPE_VALUE = "VALUE";
const VALUE_TYPE_NODE_REF = "NODE_REF";

const SERVER_HOST = process.env.SERVER_HOST;
if (!SERVER_HOST) {
  throw new Error(`Env var SERVER_HOST is required and not present.`);
}

const socket = io(SERVER_HOST);

socket.on(EVENT_SYNC_CLOCK, (timestamp) => {
  console.log(`Sync clock: ${timestamp}`);
  updateTime(timestamp);
});

socket.on(EVENT_DOCUMENT, (documentId, document, timestamp) => {
  updateTime(timestamp);

  console.log(`Received document (${documentId}): `, document);
});

socket.on("disconnect", () => {
  console.log(`Socket disconnected.`);
  console.log(`Current time: ${getTime()}`);
  console.log(`Goodbye!`);
  process.exit();
});

class DocumentContainer {
  constructor(documentId) {
    this.documentId = documentId;
    this.document = [];

    socket.on(EVENT_DOCUMENT, this.handleReceiveDocument);

    // Get any existing document from the server
    socket.emit(EVENT_REQUEST_DOCUMENT, documentId);
  }

  close() {
    socket.off(EVENT_DOCUMENT, this.handleReceiveDocument);
  }

  handleReceiveDocument(eventDocumentId, document, timestamp) {
    updateTime(timestamp);

    if (eventDocumentId === this.documentId) {
      this.document = merge(this.document, document);
    }
  }

  applyUpdates(updates) {
    // Apply the updates locally first so that this object is strongly consistent (or as close to as possible)
    this.document = merge(this.document, updates);

    socket.emit(EVENT_POST_UPDATES, documentId, updates, ({ success }) => {
      if (!success) {
        throw new Error(`Unknown error.`);
      }
    });
  }

  // An empty keyPath will return the root object.
  getValue(keyPath) {
    let obj = asObject(this.document);

    for (const key of keyPath) {
      if (!(key in obj)) {
        return undefined;
      }

      obj = obj[key];
    }

    return obj;
  }
}

function createUpdates(nodeId, key, value) {
  const updates = [];
  let valueObj;
  if (typeof value === "object") {
    // TODO: Test for cycles to prevent infinite loops
    const newNodeId = uuidV4();
    for (const key in value) {
      const nested = createUpdates(newNodeId, key, value[key]);

      updates.push(...nested);
    }

    valueObj = {
      type: VALUE_TYPE_NODE_REF,
      nodeRef: newNodeId,
    };
  } else {
    valueObj = {
      type: VALUE_TYPE_VALUE,
      value,
    };
  }

  updates.push({
    nodeId,
    key,
    timestamp: getTime(),
    value: valueObj,
  });

  return updates;
}

function createProxy(container, parentPath = []) {
  return new Proxy(
    {},
    {
      get: function (target, name, receiver) {
        // Special-purpose accessor used for managing the container lifecycle
        if (name === "__container") {
          return container;
        }

        const keyPath = [...parentPath, name];

        const value = container.getValue(keyPath);

        // This assumes it's never possible for a document node to have an object as a value.
        // This seems reasonable and consistent with the rest of the design.
        if (typeof value === "object") {
          return createProxy(container, keyPath);
        }

        return value;
      },
      set: function (target, name, value, receiver) {
        const targetNodeId = getNodeId(this.document, [...parentPath]);
        if (targetNodeId === undefined) {
          // The parent member does not exist. This shouldn't happen except maybe in a race condition.
          // TODO: Handle the case where the parent object is deleted at the same time as the access. Maybe just ignore this case?
          throw new Error(
            `Cannot set property on non-existent node. `,
            parentPath
          );
        }

        const updates = createUpdates(targetNodeId, name, value);

        container.applyUpdates(updates);
      },
    }
  );
}

function openDocument(documentId) {
  const container = new DocumentContainer(documentId);

  return createProxy(container);
}

function closeDocument(document) {
  const { __container: container } = document;

  if (container) {
    container.close();
  }
}

// Example B
const documentId = "39a2ad4b-c3a3-4a6b-b44c-9f96280aa06b";
const object = openDocument(documentId);

object.id = "myTestObject";
object.name = "Alice";
object.age = 21;

object.address = {
  streetAddress: "123 Fake St",
  city: "Vancouver",
  postalCode: "ZIP123",
  country: "Canada",
};

console.log(`documentId:`, documentId);
console.log(`object:`, object);
console.log(`object.id:`, object.id);
console.log(`object.name:`, object.name);
console.log(`object.age:`, object.age);
console.log(`object.address:`, object.address);

closeDocument(object);

// // Example A
// const documentId = "39a2ad4b-c3a3-4a6b-b44c-9f96280aa06b";
// const myKeyId = uuidV4(); // Each process gets a unique key to update
// function runExample() {
//   const update = {
//     nodeId: "root",
//     key: myKeyId,
//     timestamp: getTime(),
//     value: {
//       type: VALUE_TYPE_VALUE,
//       value: uuidV4(),
//     },
//   };

//   socket.emit(EVENT_POST_UPDATES, documentId, [update], ({ success }) => {
//     if (!success) {
//       throw new Error(`Unknown error.`);
//     }

//     // console.log(`Update acknowledged: `, update);

//     socket.emit(EVENT_REQUEST_DOCUMENT, documentId);
//   });
// }

// for (let i = 1; i <= 6; i++) {
//   runExample();
// }

console.log(`Done test!`);

const { io } = require("socket.io-client");
const { v4: uuidV4 } = require("uuid");
const { getTime, updateTime } = require("./clock");

const EVENT_SYNC_CLOCK = "sync-clock";
const EVENT_UPDATE = "update";
const EVENT_REQUEST_DOCUMENT = "request-document";
const EVENT_DOCUMENT = "document";
const VALUE_TYPE_VALUE = "VALUE";

const SERVER_HOST = process.env.SERVER_HOST;
if (!SERVER_HOST) {
  throw new Error(`Env var SERVER_HOST is required and not present.`);
}

const socket = io(SERVER_HOST);

socket.on(EVENT_SYNC_CLOCK, (timestamp) => {
  console.log(`Sync clock: ${timestamp}`);
  updateTime(timestamp);
});

socket.on(EVENT_DOCUMENT, (documentId, document) => {
  console.log(`Received document (${documentId}): `, document);

  // Find the high-watermark in the document and update the local clock.
  document.forEach(({ timestamp }) => updateTime(timestamp));
});

socket.on("disconnect", () => {
  console.log(`Socket disconnected.`);
  console.log(`Current time: ${getTime()}`);
  console.log(`Goodbye!`);
  process.exit();
});

// Example
const documentId = "39a2ad4b-c3a3-4a6b-b44c-9f96280aa06b";
const myKeyId = uuidV4(); // Each process gets a unique key to update
function runExample() {
  const update = {
    nodeId: "root",
    key: myKeyId,
    timestamp: getTime(),
    value: {
      type: VALUE_TYPE_VALUE,
      value: uuidV4(),
    },
  };

  socket.emit(EVENT_UPDATE, documentId, update, ({ success }) => {
    if (!success) {
      throw new Error(`Unknown error.`);
    }

    console.log(`Update acknowledged: `, update);

    socket.emit(EVENT_REQUEST_DOCUMENT, documentId);
  });
}

for (let i = 1; i <= 600; i++) {
  setTimeout(runExample, i * 100);
}

/**
 * An authority persists one or more documents and acts as a source-of-truth (note: NOT a _single_ source-of-truth). This is a stark
 * departure from "real" CRDTs which would normally be decentralized. The use of central authorities enables certain pragmatic design choices.
 *
 * An authority accepts any number of incoming input streams. Updates are applied in no particular order.
 *
 * The authority publishes updates to a single output stream. The output stream should go to an external
 * event stream which allows multiple subscribers to recieve updates. Only updates which result in a change
 * will be published (ie, stale updates are not published).
 *
 * The authority acknowledges receipt of updates to enable at-least-once delivery.
 *
 * Design
 * ======
 * Note: all of the following applies to a single Document. For example, references to a "single-threaded worker" mean a maximum
 * of one worker _per Document_. There are logs and cursors for each document. As a matter of practicality, the implementation may share
 * resources such as logs, cursors, or workers, across multiple documents as an optimization.
 *
 * The primary datastore for the authority is some (non-specified) form of ACID storage. This likely runs on a different server.
 * Write-Ahead Log: A local, append-only journal logs all received updates which will eventually be applied to the database.
 * Write-Ahead Cursor: A cursor tracks which journal entries have been applied to the database
 * Broadcast Log: A local, append-only journal logs all updates which mutated a document state on this authority. (does not include stale or no-op updates)
 * Broadcast Cursor: An output cursor tracks which updates have been published on the output stream.
 *
 * The following process executes when an update is received (parallelizable):
 * 1. Take a write lock on the journal
 * 2. Append the update(s) to the journal
 * 3. Update tail cursor
 *    - the tail cursor helps identify partial writes in the event of a mid-write system crash. The tail cursor is only updated
 *      after a write completes so it should always point to the end of a valid block.
 * 4. Release write lock on the journal
 * 5. (optional; high-durability configuration) Replicate journal entry to a backup instance (for failover) and wait for confirmation of replication.
 * 6. Acknowledge receipt of update
 * Note: update batches are written to the journal in a single operation; however, each will be applied independently. Batches are not transactions.
 *    Batches should be written atomically to simplify client retry semantics. Acceptable batch sizes can be limitted to offer quality of service guarantees.
 *
 * Writes to the primary store are performed by a single-threaded worker:
 * 1. Check if the Write-Ahead Cursor is behind the tail cursor; if so:
 * 2. Transactionally apply the next update to the primary datastore. This involves reading the current property value and updating if necessary. (Idempotent)
 * 3. If a property changed, append the update to the Broadcast log. (Idempotent)
 *    - TODO: The DB transaction and the write to the broadcast log are not atomic. That means it's possible to mutate data without broadcasting. For example,
 *         the system can crash after the transaction commits and before the Breadcast Log is updated. When the update is retried after boot, there will be no
 *         detected change in the DB and so no update will be written to the Broadcast Log.
 *         Is the correct fix to write to the Broadcast Log before committing the transaction? There seems to be no obvious cost of a false positive on the broadcast
 *         log if the change has already been committed to the Write-Ahead Log.
 * 4. Update the Write-Ahead Cursor to this update ID.
 * 5. Return to Step 1.
 *
 * Updates broadcasts are performed by a similar worker:
 * 1. Check if the Broadcast Cursor is behind the Write-Ahead Cursor; if so:
 * 2. Publish the intermediate update(s) to the output stream (these can be published in batches).
 * 3. Update the Broadcast Cursor.
 * 4. Return to Step 1.
 *
 * Authority Topologies
 * ====================
 * Multi-Region Replication
 * ------------------------
 * Authorities can be setup in multiple geographic regions to provide close proximity access to clients around the globe. Each
 * authority instance subscribes to the output streams of the other authorities so that all updates are replicated globally. It
 * is likely simlpest if all authorities share a single output bus to which each can subscribe.
 * An authority must drain all known updates to the output stream prior to removal from the network to prevent potential data loss.
 *
 * Multi-Master Replication
 * ------------------------
 * This is the generalized form of multi-region replication and operates identically.
 *
 * Fan-In Proxies
 * --------------
 * If there is need handle inbound update streams from a very large number of clients, it may be helpful to introduce a layer
 * of horizontally scalable proxy authorities. The term authority is a misnomer for these proxies as they will not generally act
 * as a global source-of-truth. These proxy authorities can scale the number of inbound connections by collecting updates from multiple
 * clients and forwarding them in batches to the primary authority. Additionally, these proxies can detect and drop stale updates and
 * negate the need for a primary authority to receive them at all. The usefullness of this topology will be context dependent and likely
 * limitted to only very high volume use cases.
 */
const { Server } = require("socket.io");
const fastq = require("fastq");
const { getTime, updateTime } = require("./clock");
const { merge } = require("./crdt");

const EVENT_SYNC_CLOCK = "sync-clock";
const EVENT_POST_UPDATES = "post-updates";
const EVENT_BROADCAST_UPDATE = "broadcast-update";
const EVENT_REQUEST_DOCUMENT = "request-document";
const EVENT_DOCUMENT = "document";

const INBOUND_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const inboundIo = new Server(INBOUND_PORT);

// TODO: Persist somewhere durable
const documents = {};

function handleUpdate({ documentId, update }, cb) {
  let document = [update];
  if (documents[documentId]) {
    document = merge(documents[documentId], document);
  }
  documents[documentId] = document;
  cb();
  console.log(`Updated document (${documentId}): `, document);
}

// Updates are applied on a single worker because this particular worker is not thread-safe
const updateQueue = fastq(handleUpdate, 1);

inboundIo.on("connection", (socket) => {
  socket.emit(EVENT_SYNC_CLOCK, getTime());

  socket.on(EVENT_POST_UPDATES, (documentId, updates, callback) => {
    // Update the clock based on the update timestamp
    updates.forEach((update) => updateTime(update.timestamp));

    // TODO: Write the update to a queue and acknowledge immediately. Document updates can be asyncronous.
    for (const update of updates) {
      updateQueue.push({ documentId, update });
    }

    // Acknowledge receipt
    callback({ success: true });
  });

  socket.on(EVENT_REQUEST_DOCUMENT, (documentId) => {
    const document = documents[documentId];
    socket.emit(EVENT_DOCUMENT, documentId, document, getTime());
  });
});

console.log(`Current time: ${getTime()}`);

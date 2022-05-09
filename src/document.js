const { emptyDocument, getNodeKeys } = require("./crdt");

class Document {
  constructor(state) {
    this.state = state;
  }

  keys(nodePath = []) {
    return getNodeKeys(this.state, nodePath);
  }
}

function createDocument() {
  const state = emptyDocument();

  return new Document(state);
}

module.exports = {
  createDocument,
};

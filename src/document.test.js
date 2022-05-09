const { createDocument } = require("./document");

describe("createDocument()", () => {
  test(`it returns an empty document`, () => {
    const result = createDocument();

    expect(result.keys()).toEqual([]);
  });
});

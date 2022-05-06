const { asObject, merge } = require(".");

const updateId1 = {
  nodeId: "root",
  key: "id",
  timestamp: 1,
  value: {
    type: "VALUE",
    value: "c87c0491-5559-44b6-bf63-00a575e338ec",
  },
};

const updateTitle2 = {
  nodeId: "root",
  key: "title",
  timestamp: 2,
  value: {
    type: "VALUE",
    value: "Example Domain",
  },
};

const updateUrl3 = {
  nodeId: "root",
  key: "url",
  timestamp: 3,
  value: {
    type: "VALUE",
    value: "https://example.com/",
  },
};

const updateTitle4 = {
  nodeId: "root",
  key: "title",
  timestamp: 4,
  value: {
    type: "VALUE",
    value: "A new title",
  },
};

const updateStyleForeground5 = {
  nodeId: "81572135-fbf5-4662-9a8a-8971272cc436",
  key: "foreground",
  timestamp: 5,
  value: {
    type: "VALUE",
    value: "#ffffff",
  },
};

const updateStyle6 = {
  nodeId: "root",
  key: "style",
  timestamp: 6,
  value: {
    type: "NODE_REF",
    nodeRef: "81572135-fbf5-4662-9a8a-8971272cc436",
  },
};

describe(`merge(a, b)`, () => {
  test(`produces a document containing all updates with unique node-key pairs`, () => {
    const documentA = [updateId1, updateTitle2];
    const documentB = [updateUrl3];

    const result = merge(documentA, documentB);

    expect(result.length).toBe(3);

    // Check equality of fields, not object identity
    expect(result).toContainEqual(updateId1);
    expect(result).toContainEqual(updateTitle2);
    expect(result).toContainEqual(updateUrl3);
  });

  test(`removes duplicates`, () => {
    const documentA = [updateId1, updateTitle2];
    const documentB = [updateUrl3, updateTitle2];

    const result = merge(documentA, documentB);

    expect(result.length).toBe(3);

    // Check equality of fields, not object identity
    expect(result).toContainEqual(updateId1);
    expect(result).toContainEqual(updateTitle2);
    expect(result).toContainEqual(updateUrl3);
  });

  test(`prunes outdated changes`, () => {
    const documentA = [updateId1, updateTitle2];
    const documentB = [updateUrl3, updateTitle4];

    const result = merge(documentA, documentB);

    expect(result.length).toBe(3);

    // Check equality of fields, not object identity
    expect(result).toContainEqual(updateId1);
    expect(result).toContainEqual(updateUrl3);
    expect(result).toContainEqual(updateTitle4);
  });

  test(`consistently resolves competing updates`, () => {
    const changeA = {
      nodeId: "root",
      key: "title",
      timestamp: 5,
      value: {
        type: "VALUE",
        value: "New Proper Title",
      },
    };

    const changeB = {
      nodeId: "root",
      key: "title",
      timestamp: 5,
      value: {
        type: "VALUE",
        value: "Competing title change",
      },
    };

    // Apply the changes in different orders
    const resultA = merge([updateId1, changeA], [changeB]);
    const resultB = merge([updateId1, changeB], [changeA]);

    // Find all matching updates
    const resultATitleUpdate = resultA.filter((e) => e.key === "title");
    const resultBTitleUpdate = resultB.filter((e) => e.key === "title");

    expect(resultATitleUpdate.length).toBe(1);
    expect(resultBTitleUpdate.length).toBe(1);
    expect(resultATitleUpdate[0].value).toBe(resultBTitleUpdate[0].value);
  });

  test(`delete wins for simultaneous updates`, () => {
    const changeA = {
      nodeId: "root",
      key: "title",
      timestamp: 5,
      value: {
        type: "VALUE",
        value: "New Proper Title",
      },
    };

    const changeB = {
      nodeId: "root",
      key: "title",
      timestamp: 5,
      value: {
        type: "VALUE",
        value: undefined,
      },
    };

    // Apply the changes in different orders
    const resultA = merge([updateId1, changeA], [changeB]);
    const resultB = merge([updateId1, changeB], [changeA]);

    // Find all matching updates
    const selectedA = resultA.find((e) => e.key === "title");
    const selectedB = resultB.find((e) => e.key === "title");

    expect(selectedA.value.type).toBe("VALUE");
    expect(selectedA.value.value).toBe(undefined);
    expect(selectedB.value.type).toBe("VALUE");
    expect(selectedB.value.value).toBe(undefined);
  });
});

describe(`asObject(document)`, () => {
  test(`returns an empty object for an empty document`, () => {
    const result = asObject([]);
    expect(result).toEqual({});
  });

  test(`produces the expected object from a document`, () => {
    const document = [updateId1, updateTitle2, updateUrl3];

    const result = asObject(document);

    expect(result.id).toBe("c87c0491-5559-44b6-bf63-00a575e338ec");
    expect(result.title).toBe("Example Domain");
    expect(result.url).toBe("https://example.com/");
  });

  test(`uses the most recent values`, () => {
    const document = [updateId1, updateTitle2, updateUrl3, updateTitle4];

    const result = asObject(document);

    expect(result.id).toBe("c87c0491-5559-44b6-bf63-00a575e338ec");
    expect(result.title).toBe("A new title");
    expect(result.url).toBe("https://example.com/");
  });

  test(`allows nesting objects with references`, () => {
    const document = [
      updateId1,
      updateTitle2,
      updateStyleForeground5,
      updateStyle6,
    ];

    const result = asObject(document);

    expect(result.id).toBe("c87c0491-5559-44b6-bf63-00a575e338ec");
    expect(result.title).toBe("Example Domain");
    expect(result.style).toBeDefined();
    expect(result.style.foreground).toBe("#ffffff");
  });
});

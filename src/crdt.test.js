const {
  asObject,
  merge,
  emptyDocument,
  getNodeKeys,
  updateValue,
  updateNodeRef,
} = require("./crdt");

const updateId1 = updateValue(
  "root",
  "id",
  "c87c0491-5559-44b6-bf63-00a575e338ec",
  1
);

const updateTitle2 = updateValue("root", "title", "Example Domain", 2);

const updateUrl3 = updateValue("root", "url", "https://example.com/", 3);

const updateTitle4 = updateValue("root", "title", "A new title", 4);

const updateStyleForeground5 = updateValue(
  "81572135-fbf5-4662-9a8a-8971272cc436",
  "foreground",
  "#ffffff",
  5
);

const updateStyle6 = updateNodeRef(
  "root",
  "style",
  "81572135-fbf5-4662-9a8a-8971272cc436",
  6
);

describe(`emptyDocument()`, () => {
  test(`produces a document with no updates`, () => {
    const result = emptyDocument();

    expect(result.length).toBe(0);
  });
});

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
    const changeA = updateValue("root", "title", "One Title Change", 5);
    const changeB = updateValue("root", "title", "Competing title change", 5);

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
    const changeA = updateValue("root", "title", "Some New Title", 5);
    const changeB = updateValue("root", "title", undefined, 5);

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

describe(`getNodeKeys(document)`, () => {
  test(`returns an empty list for an empty document`, () => {
    const result = getNodeKeys([], []);

    expect(result.length).toBe(0);
  });

  test(`returns all keys for a simple document`, () => {
    const document = [updateId1, updateTitle2];

    const result = getNodeKeys(document, []);

    expect(result.length).toBe(2);
    expect(result).toContain("id");
    expect(result).toContain("title");
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

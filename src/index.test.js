const { asObject, merge } = require(".");

const updateId1 = {
  key: "id",
  value: "c87c0491-5559-44b6-bf63-00a575e338ec",
  timestamp: 1,
};

const updateTitle2 = {
  key: "title",
  value: "Example Domain",
  timestamp: 2,
};

const updateUrl3 = {
  key: "url",
  value: "https://example.com/",
  timestamp: 3,
};

const updateTitle4 = {
  key: "title",
  value: "A new title",
  timestamp: 4,
};

describe(`merge(a, b)`, () => {
  test(`produces a set containing all elements with unique keys`, () => {
    const setA = [updateId1, updateTitle2];
    const setB = [updateUrl3];

    const result = merge(setA, setB);

    expect(result.length).toBe(3);

    // Check equality of fields, not object identity
    expect(result).toContainEqual(updateId1);
    expect(result).toContainEqual(updateTitle2);
    expect(result).toContainEqual(updateUrl3);
  });

  test(`removes duplicates`, () => {
    const setA = [updateId1, updateTitle2];
    const setB = [updateUrl3, updateTitle2];

    const result = merge(setA, setB);

    expect(result.length).toBe(3);

    // Check equality of fields, not object identity
    expect(result).toContainEqual(updateId1);
    expect(result).toContainEqual(updateTitle2);
    expect(result).toContainEqual(updateUrl3);
  });

  test(`prunes outdated changes`, () => {
    const setA = [updateId1, updateTitle2];
    const setB = [updateUrl3, updateTitle4];

    const result = merge(setA, setB);

    expect(result.length).toBe(3);

    // Check equality of fields, not object identity
    expect(result).toContainEqual(updateId1);
    expect(result).toContainEqual(updateUrl3);
    expect(result).toContainEqual(updateTitle4);
  });

  test(`consistently resolves competing updates`, () => {
    const changeA = {
      key: "title",
      value: "New Proper Title",
      timestamp: 5,
    };

    const changeB = {
      key: "title",
      value: "Competing title change",
      timestamp: 5,
    };

    // Apply the changes in different orders
    const resultA = merge([updateId1, changeA], [changeB]);
    const resultB = merge([updateId1, changeB], [changeA]);

    // Find all matching updates
    const resultASelected = resultA.filter((e) => e.key === "title");
    const resultBSelected = resultB.filter((e) => e.key === "title");

    expect(resultASelected.length).toBe(1);
    expect(resultBSelected.length).toBe(1);
    expect(resultASelected[0].value).toBe(resultBSelected[0].value);
  });

  test(`delete wins for simultaneous updates`, () => {
    const changeA = {
      key: "title",
      value: "New Proper Title",
      timestamp: 5,
    };

    const changeB = {
      key: "title",
      value: undefined,
      timestamp: 5,
    };

    // Apply the changes in different orders
    const resultA = merge([updateId1, changeA], [changeB]);
    const resultB = merge([updateId1, changeB], [changeA]);

    // Find all matching updates
    const selectedA = resultA.find((e) => e.key === "title");
    const selectedB = resultB.find((e) => e.key === "title");

    expect(selectedA.value).toBe(undefined);
    expect(selectedB.value).toBe(undefined);
  });
});

describe(`asObject(s)`, () => {
  test(`produces the expected object from a set`, () => {
    const input = [updateId1, updateTitle2, updateUrl3];

    const result = asObject(input);

    expect(result.id).toBe("c87c0491-5559-44b6-bf63-00a575e338ec");
    expect(result.title).toBe("Example Domain");
    expect(result.url).toBe("https://example.com/");
  });

  test(`uses the most recent values`, () => {
    const input = [updateId1, updateTitle2, updateUrl3, updateTitle4];

    const result = asObject(input);

    expect(result.id).toBe("c87c0491-5559-44b6-bf63-00a575e338ec");
    expect(result.title).toBe("A new title");
    expect(result.url).toBe("https://example.com/");
  });
});

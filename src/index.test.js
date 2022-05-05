const { asObject, merge } = require(".");

const update1 = {
  key: "id",
  value: "c87c0491-5559-44b6-bf63-00a575e338ec",
  timestamp: 1,
};

const update2 = {
  key: "title",
  value: "Example Domain",
  timestamp: 2,
};

const update3 = {
  key: "url",
  value: "https://example.com/",
  timestamp: 3,
};

const update4 = {
  key: "title",
  value: "A new title",
  timestamp: 4,
};

describe(`merge(a, b)`, () => {
  test(`produces a set containing all elements with unique keys`, () => {
    const setA = [update1, update2];
    const setB = [update3];

    const result = merge(setA, setB);

    expect(result.length).toBe(3);

    // Check equality of fields, not object identity
    expect(result).toContainEqual(update1);
    expect(result).toContainEqual(update2);
    expect(result).toContainEqual(update3);
  });

  test(`removes duplicates`, () => {
    const setA = [update1, update2];
    const setB = [update3, update2];

    const result = merge(setA, setB);

    expect(result.length).toBe(3);

    // Check equality of fields, not object identity
    expect(result).toContainEqual(update1);
    expect(result).toContainEqual(update2);
    expect(result).toContainEqual(update3);
  });
});

describe(`asObject(s)`, () => {
  test(`produces the expected object from a set`, () => {
    const input = [update1, update2, update3];

    const result = asObject(input);

    expect(result.id).toBe("c87c0491-5559-44b6-bf63-00a575e338ec");
    expect(result.title).toBe("Example Domain");
    expect(result.url).toBe("https://example.com/");
  });

  test(`uses the most recent values`, () => {
    const input = [update1, update2, update3, update4];

    const result = asObject(input);

    expect(result.id).toBe("c87c0491-5559-44b6-bf63-00a575e338ec");
    expect(result.title).toBe("A new title");
    expect(result.url).toBe("https://example.com/");
  });
});

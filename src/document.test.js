const { createDocument } = require("./document");

describe("createDocument()", () => {
  test(`it returns an empty document`, () => {
    const result = createDocument();

    expect(result.keys()).toEqual([]);
  });
});

describe("Document", () => {
  test("A property can be set and read on the root", () => {
    const document = createDocument();

    document.set("id", "190ca7fe-5e39-4adc-b2c1-d4840bafc733", 1);

    const readResult = document.get("id");

    expect(readResult).toBe("190ca7fe-5e39-4adc-b2c1-d4840bafc733");
  });

  test("A property can be set on a nested node", () => {
    const document = createDocument();

    document.set("style.foreground", "#ffffff", 1);

    const result = document.get("style.foreground");

    expect(result).toBe("#ffffff");
  });

  test("A node can be read and used to get properties", () => {
    const document = createDocument();

    document.set("style.foreground", "#000000", 1);

    const styleNode = document.get("style");

    const result = styleNode.get("foreground");

    expect(result).toBe("#000000");
  });

  test("Can get a list of keys from the root", () => {
    const document = createDocument();

    document.set("id", "190ca7fe-5e39-4adc-b2c1-d4840bafc733", 1);
    document.set("title", "Example Title", 1);

    const result = document.keys();

    expect(result.length).toBe(2);
    expect(result).toContain("id");
    expect(result).toContain("title");
  });
});

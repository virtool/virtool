import {
  filesSelector,
  otusSelector,
  subtractionsSelector,
  usersSelector
} from "./listSelectors";

describe("Selectors tests", () => {
  const state = {
    files: { documents: [{ id: "foo" }, { id: "fud" }] },
    otus: { documents: [{ id: "qux" }, { id: "quark" }] },
    subtraction: { documents: [{ id: "hello" }, { id: "world" }] },
    users: {
      list: {
        documents: [{ id: "test" }, { id: "example" }],
        page: 1,
        page_count: 1
      }
    }
  };
  let result;
  let expected;

  it("filesSelector: returns data used to render a list of files", () => {
    result = filesSelector(state);
    expected = ["foo", "fud"];
    expect(result).toEqual(expected);
  });

  it("otusSelector: returns data used to render a list of otus", () => {
    result = otusSelector(state);
    expected = ["qux", "quark"];
    expect(result).toEqual(expected);
  });

  it("subtractionsSelector: returns data used to render a list of subtractions", () => {
    result = subtractionsSelector(state);
    expected = ["hello", "world"];
    expect(result).toEqual(expected);
  });

  it("usersSelector: returns data used to render a list of users", () => {
    result = usersSelector(state);
    expected = {
      documents: ["test", "example"],
      page: 1,
      page_count: 1
    };
    expect(result).toEqual(expected);

    result = usersSelector({ users: { list: null } });
    expected = { documents: null, page: 0, page_count: 0 };
    expect(result).toEqual(expected);
  });
});

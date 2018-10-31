import { filesSelector } from "./selectors";

describe("Test Files Selectors", () => {
    const state = {
        files: { documents: [{ id: "foo" }, { id: "fud" }] }
    };

    let result;
    let expected;

    it("filesSelector: returns data used to render a list of files", () => {
        result = filesSelector(state);
        expected = ["foo", "fud"];
        expect(result).toEqual(expected);
    });
});

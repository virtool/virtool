import { subtractionsSelector } from "./selectors";

describe("Subtracion Selectors", () => {
    const state = {
        subtraction: { documents: [{ id: "hello" }, { id: "world" }] }
    };

    let result;
    let expected;

    it("subtractionsSelector: returns data used to render a list of subtractions", () => {
        result = subtractionsSelector(state);
        expected = ["hello", "world"];
        expect(result).toEqual(expected);
    });
});

import { getHasOfficial } from "../selectors";

describe("getHasOfficial", () => {
    let state;

    beforeEach(() => {
        state = {
            references: {
                documents: []
            }
        };
    });

    it("returns false when documents empty", () => {
        const result = getHasOfficial(state);
        expect(result).toBe(false);
    });

    it("returns false when no official refs found", () => {
        state.references.documents = [{ id: "official" }];
        const result = getHasOfficial(state);
        expect(result).toBe(false);
    });

    it("returns true when official ref found", () => {
        state.references.documents = [
            {
                id: "official",
                remotes_from: { errors: [], slug: "virtool/ref-plant-viruses" }
            }
        ];
        const result = getHasOfficial(state);
        expect(result).toBe(true);
    });
});

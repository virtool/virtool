import { getHasOfficial } from "../selectors";

describe("getHasOfficial", () => {
    it("returns false when documents empty", () => {
        const documents = [];
        const result = getHasOfficial({ documents });
        expect(result).toBe(false);
    });

    it("returns false when no official refs found", () => {
        const documents = [{ id: "official" }];
        const result = getHasOfficial({ documents });
        expect(result).toBe(false);
    });

    it("returns true when official ref found", () => {
        const documents = [
            {
                id: "official",
                remotes_from: { errors: [], slug: "virtool/ref-plant-viruses" }
            }
        ];
        const result = getHasOfficial({ documents });
        expect(result).toBe(true);
    });
});

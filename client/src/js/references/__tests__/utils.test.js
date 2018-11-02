import { checkHasOfficialRemote, removeMember } from "../utils";

describe("Reference utils", () => {
    describe("checkHasOfficialRemote", () => {
        it("returns false when documents empty", () => {
            const documents = [];
            const result = checkHasOfficialRemote({ documents });
            expect(result).toBe(false);
        });

        it("returns false when no official refs found", () => {
            const documents = [{ id: "official" }];
            const result = checkHasOfficialRemote({ documents });
            expect(result).toBe(false);
        });

        it("returns true when official ref found", () => {
            const documents = [
                {
                    id: "official",
                    remotes_from: { errors: [], slug: "virtool/ref-plant-viruses" }
                }
            ];
            const result = checkHasOfficialRemote({ documents });
            expect(result).toBe(true);
        });
    });

    describe("removeMember", () => {
        it("has no effect on empty documents", () => {
            const result = removeMember([], []);
            expect(result).toEqual([]);
        });

        it("has no effect when documents not in pendingRemoves", () => {
            const documents = [{ id: "foo" }];
            const pendingRemoves = ["bar"];
            const result = removeMember(documents, pendingRemoves);
            expect(result).toEqual(documents);
        });

        it("remove document when in pendingRemoves", () => {
            const documents = [{ id: "foo" }];
            const pendingRemoves = ["foo"];
            const result = removeMember(documents, pendingRemoves);
            expect(result).toEqual([]);
        });
    });
});

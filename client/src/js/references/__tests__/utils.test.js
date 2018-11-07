import { removeMember } from "../utils";

describe("Reference utils", () => {
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

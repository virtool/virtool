import { getIndexes, getActiveIndexId } from "../selectors";

describe("getIndexes()", () => {
    let state;

    beforeEach(() => {
        state = {
            indexes: {
                documents: [
                    {
                        id: "foo"
                    }
                ]
            }
        };
    });

    it("should return index documents when they exist", () => {
        const result = getIndexes(state);
        expect(result).toEqual([{ id: "foo" }]);
    });

    it("should return empty list when index documents are empty", () => {
        state.indexes.documents = [];
        const result = getIndexes(state);
        expect(result).toEqual([]);
    });

    it("should return empty list when index documents are null", () => {
        state.indexes.documents = null;
        const result = getIndexes(state);
        expect(result).toEqual([]);
    });
});

describe("getActiveIndexId()", () => {
    let state;

    beforeEach(() => {
        state = {
            indexes: {
                documents: [
                    {
                        id: "foo",
                        ready: true,
                        has_files: true
                    },
                    {
                        id: "bar",
                        ready: true,
                        has_files: false
                    },
                    {
                        id: "baz",
                        ready: false,
                        has_files: true
                    },
                    {
                        id: "pop",
                        ready: false,
                        has_files: false
                    }
                ]
            }
        };
    });

    it("should return id of active index when first item", () => {
        const activeId = getActiveIndexId(state);
        expect(activeId).toBe("foo");
    });

    it("should return id of active index when second item", () => {
        state.indexes.documents[0].ready = false;
        state.indexes.documents[1].has_files = true;
        const activeId = getActiveIndexId(state);
        expect(activeId).toBe("bar");
    });

    it("should return id of active index when two possibilities", () => {
        state.indexes.documents[1].has_files = true;
        const activeId = getActiveIndexId(state);
        expect(activeId).toBe("foo");
    });

    it("should return undefined when no active indexes", () => {
        state.indexes.documents[0].has_files = false;
        const activeId = getActiveIndexId(state);
        expect(activeId).toBeUndefined();
    });
});

import { insert, remove, update, updateDocuments } from "../reducers";

describe("Reducer utility functions", () => {
    let documents;

    beforeEach(() => {
        documents = [
            { id: "bar", meta: "alpha" },
            { id: "baz", meta: "gamma" },
            { id: "foo", meta: "beta" }
        ];
    });

    describe("updateDocuments: updates documents with action data", () => {
        it("should insert all if [documents=null]", () => {
            const state = {
                documents: null
            };
            const action = {
                type: "UPDATE_DOCUMENTS",
                data: {
                    documents,
                    page: 1
                }
            };
            const result = updateDocuments(state, action);
            expect(result).toEqual({
                documents,
                page: 1
            });
        });

        it("should insert all if [documents=[]]", () => {
            const state = {
                documents: []
            };
            const action = {
                type: "UPDATE_DOCUMENTS",
                data: {
                    documents,
                    page: 1
                }
            };
            const result = updateDocuments(state, action);
            expect(result).toEqual({
                documents,
                page: 1
            });
        });

        it("should update existing", () => {
            const state = {
                documents
            };
            const updated = [
                { ...documents[0], meta: "theta" },
                { id: "test", meta: "chi" }
            ];
            const action = {
                type: "UPDATE_DOCUMENTS",
                data: {
                    documents: updated,
                    page: 2
                }
            };
            const result = updateDocuments(state, action);
            expect(result).toEqual({
                documents: [updated[0], { id: "test", meta: "chi" }, documents[1], documents[2]],
                page: 2
            });
        });

        it("should update existing and sort by key", () => {
            const state = {
                documents
            };
            const updated = [
                { ...documents[0], meta: "theta" },
                { id: "test", meta: "chi" }
            ];
            const action = {
                type: "UPDATE_DOCUMENTS",
                data: {
                    documents: updated,
                    page: 2
                }
            };
            const result = updateDocuments(state, action, "meta");
            expect(result).toEqual({
                documents: [documents[2], { id: "test", meta: "chi" }, documents[1], updated[0]],
                page: 2
            });
        });

        it("should update existing and sort in reverse", () => {
            const state = {
                documents
            };
            const updated = [
                { ...documents[0], meta: "theta" },
                { id: "test", meta: "chi" }
            ];
            const action = {
                type: "UPDATE_DOCUMENTS",
                data: {
                    documents: updated,
                    page: 2
                }
            };
            const result = updateDocuments(state, action, "meta", true);
            expect(result).toEqual({
                documents: [updated[0], documents[1], { id: "test", meta: "chi" }, documents[2]],
                page: 2
            });
        });
    });

    describe("insert: inserts new document", () => {
        it("insert document", () => {
            const state = {
                documents
            };
            const action = {
                type: "WS_INSERT_ENTRY",
                data: { id: "test", meta: "chi" }
            };
            const result = insert(state, action);
            expect(result).toEqual({ documents: [...documents, action.data] });
        });

        it("inserts and sorts by key", () => {
            const state = {
                documents
            };
            const action = {
                type: "WS_INSERT_ENTRY",
                data: { id: "test", meta: "theta" }
            };
            const result = insert(state, action, "meta");
            expect(result).toEqual({ documents: [documents[0], documents[2], documents[1], action.data] });
        });

        it("inserts and sorts by key in reverse", () => {
            const state = {
                documents
            };
            const action = {
                type: "WS_INSERT_ENTRY",
                data: { id: "test", meta: "theta" }
            };
            const result = insert(state, action, "meta", true);
            expect(result).toEqual({ documents: [action.data, documents[1], documents[2], documents[0]] });
        });

        it("handles [documents=[]]", () => {
            const state = {
                documents: []
            };
            const action = {
                type: "WS_INSERT",
                data: { id: "test" }
            };
            const result = insert(state, action);
            expect(result).toEqual({ documents: [{ id: "test" }] });
        });

        it("handles [documents=null]", () => {
            const state = {
                documents: null
            };
            const action = {
                type: "WS_INSERT_ENTRY",
                data: { id: "test" }
            };
            const result = insert(state, action);
            expect(result).toEqual({ documents: [{ id: "test" }] });
        });
    });

    describe("update: updates entry in documents array", () => {
        it("update if document in list", () => {
            // Update entry when present in list
            const state = { documents };
            const action = {
                type: "WS_UPDATE",
                data: { id: "foo", meta: "chi" }
            };
            const result = update(state, action);
            expect(result).toEqual({
                documents: [documents[0], documents[1], { ...documents[2], meta: "chi" }]
            });
        });

        it("does not update if document not in list", () => {
            // No change when not present in list
            const state = { documents };
            const action = {
                type: "WS_UPDATE",
                data: { id: "test", meta: "chi" }
            };
            const result = update(state, action);
            expect(result).toEqual(state);
        });

        it("updates and sorts by key", () => {
            const state = {
                documents
            };
            const action = {
                type: "WS_UPDATE",
                data: { id: "bar", meta: "chi" }
            };
            const result = update(state, action, "meta");
            expect(result).toEqual({ documents: [documents[2], { ...documents[0], meta: "chi" }, documents[1]] });
        });

        it("updates and sorts by key in reverse", () => {
            const state = {
                documents
            };
            const action = {
                type: "WS_UPDATE",
                data: { id: "bar", meta: "chi" }
            };
            const result = update(state, action, "meta", true);
            expect(result).toEqual({ documents: [documents[1], { ...documents[0], meta: "chi" }, documents[2]] });
        });

        it("handles [documents=[]]", () => {
            const state = {
                documents: []
            };
            const action = {
                type: "WS_UPDATE",
                data: { id: "test", meta: "chi" }
            };
            const result = update(state, action);
            expect(result).toEqual(state);
        });

        it("handles [documents=null]", () => {
            const state = {
                documents: null
            };
            const action = {
                type: "WS_UPDATE",
                data: { id: "test", meta: "chi" }
            };
            const result = update(state, action);
            expect(result).toEqual(state);
        });
    });

    describe("remove: removes entry from documents array", () => {
        it("remove one document", () => {
            // No change to empty list
            const state = { documents };
            const action = {
                type: "WS_REMOVE",
                data: ["foo"]
            };
            const result = remove(state, action);
            expect(result).toEqual({ documents: [documents[0], documents[1]] });
        });

        it("removes multiple documents", () => {
            const state = {
                documents
            };
            const action = {
                type: "WS_REMOVE",
                data: ["foo", "bar"]
            };
            const result = remove(state, action);
            expect(result).toEqual({
                documents: [documents[1]]
            });
        });

        it("removes nothing if no match", () => {
            // No change if not present in list
            const state = { documents };
            const action = {
                type: "WS_REMOVE",
                data: ["test"]
            };
            const result = remove(state, action);
            expect(result).toEqual(state);
        });

        it("handles [documents=[]]", () => {
            const state = {
                documents: []
            };
            const action = {
                type: "WS_REMOVE",
                data: ["foo"]
            };
            const result = remove(state, action);
            expect(result).toEqual(state);
        });

        it("handles [documents=null]", () => {
            const state = {
                documents: null
            };
            const action = {
                type: "WS_REMOVE",
                data: ["foo", "bar"]
            };
            const result = remove(state, action);
            expect(result).toEqual(state);
        });
    });
});

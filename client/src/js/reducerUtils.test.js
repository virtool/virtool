import * as reducerUtils from "./reducerUtils";

describe("Utility functions for reducers", () => {
  let documents;
  let action;
  let page;
  let per_page;
  let result;
  let expected;

  describe("updateDocuments: updates documents array with action data", () => {
    documents = [{ id: "bar" }, { id: "baz" }, { id: "foo" }];
    page = 1;
    per_page = 3;

    it("replace page if page number matches", () => {
      action = {
        type: "UPDATE_LIST",
        data: {
          documents: [{ id: "bar" }, { id: "foo" }, { id: "world" }],
          page: 1,
          per_page: 3
        }
      };
      result = reducerUtils.updateDocuments(documents, action, page);
      expected = {
        page: action.data.page,
        per_page: action.data.per_page,
        documents: action.data.documents
      };
      expect(result).toEqual(expected);
    });

    it("If response data is for the next page, concat to documents", () => {
      action = {
        type: "UPDATE_LIST",
        data: {
          documents: [{ id: "hello" }, { id: "test" }, { id: "world" }],
          page: 2,
          per_page: 3
        }
      };
      result = reducerUtils.updateDocuments(documents, action, page);
      expected = {
        page: action.data.page,
        per_page: action.data.per_page,
        documents: [
          { id: "bar" },
          { id: "baz" },
          { id: "foo" },
          { id: "hello" },
          { id: "test" },
          { id: "world" }
        ]
      };
      expect(result).toEqual(expected);
    });

    it("handles [documents=null]", () => {
      documents = null;
      page = 0;
      action = {
        type: "UPDATE_LIST",
        data: {
          documents: [{ id: "bar" }, { id: "foo" }, { id: "world" }],
          page: 1,
          per_page: 3
        }
      };
      result = reducerUtils.updateDocuments(documents, action, page);
      expected = action.data;

      expect(result).toEqual(expected);
    });
  });

  describe("insert: inserts new entry into documents array", () => {
    it("insert entry and return currently viewable pages", () => {
      // Return new list if addition of new entry is contained
      // within the currently stored number of pages
      documents = [{ id: "bar" }, { id: "foo" }];
      action = {
        type: "WS_INSERT_ENTRY",
        data: { id: "test" }
      };
      page = 1;
      per_page = 3;
      result = reducerUtils.insert(documents, page, per_page, action, "id");
      expected = [{ id: "bar" }, { id: "foo" }, { id: "test" }];
      expect(result).toEqual(expected);

      // Return sublist if addition of new entry is not contained
      // in currently stored pages
      documents = [{ id: "bar" }, { id: "foo" }, { id: "hello" }];
      result = reducerUtils.insert(documents, page, per_page, action);
      expected = documents;
      expect(result).toEqual(expected);
    });

    it("handles [documents=null]", () => {
      documents = null;
      action = {
        type: "WS_INSERT_ENTRY",
        data: { id: "test" }
      };
      page = 0;
      per_page = undefined;
      result = reducerUtils.insert(documents, page, per_page, action, "id");
      expected = [{ id: "test" }];
      expect(result).toEqual(expected);
    });
  });

  describe("edit: updates entry in documents array", () => {
    it("update entry with new data if found in documents", () => {
      // No change to empty list
      action = {
        type: "WS_UPDATE_ENTRY",
        data: { id: "test", name: "TEST" }
      };
      result = reducerUtils.edit([], action);
      expect(result).toEqual([]);

      // No change when not present in list
      documents = [
        { id: "bar", name: "bar-entry" },
        { id: "foo", name: "foo-entry" }
      ];
      result = reducerUtils.edit(documents, action);
      expect(result).toEqual(documents);

      // Update entry when present in list
      const documentsExist = [...documents, { id: "test", name: "test-entry" }];
      result = reducerUtils.edit(documentsExist, action);
      expected = [...documents, { id: "test", name: "TEST" }];
      expect(result).toEqual(expected);
    });

    it("handles [documents=null]", () => {
      documents = null;
      action = {
        type: "WS_UPDATE_ENTRY",
        data: { id: "test", name: "TEST" }
      };
      result = reducerUtils.edit(documents, action);
      expected = null;
      expect(result).toEqual(expected);
    });
  });

  describe("remove: removes entry from documents array", () => {
    it("remove entry if found in documents", () => {
      // No change to empty list
      documents = [];
      action = {
        type: "WS_REMOVE_ENTRY",
        data: ["test"]
      };
      result = reducerUtils.remove(documents, action);
      expected = documents;
      expect(result).toEqual(expected);

      // No change if not present in list
      documents = [{ id: "foo" }, { id: "bar" }];
      result = reducerUtils.remove(documents, action);
      expected = documents;
      expect(result).toEqual(expected);

      // Removed if present in list
      documents = [{ id: "test" }];
      result = reducerUtils.remove(documents, action);
      expected = [];
      expect(result).toEqual(expected);

      documents = [{ id: "foo" }, { id: "test" }, { id: "bar" }];
      result = reducerUtils.remove(documents, action);
      expected = [{ id: "foo" }, { id: "bar" }];
      expect(result).toEqual(expected);
    });

    it("removes multiple entries", () => {
      documents = [{ id: "test1" }, { id: "test2" }, { id: "test3" }];
      action = {
        type: "WS_REMOVE_ENTRY",
        data: ["test1", "test2"]
      };
      result = reducerUtils.remove(documents, action);
      expected = [{ id: "test3" }];
      expect(result).toEqual(expected);
    });

    it("handles [documents=null]", () => {
      documents = null;
      result = reducerUtils.remove(documents, action);
      expected = null;
      expect(result).toEqual(expected);
    });
  });
});

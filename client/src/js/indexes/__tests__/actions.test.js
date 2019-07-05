import {
    WS_INSERT_INDEX,
    WS_UPDATE_INDEX,
    GET_INDEX,
    GET_UNBUILT,
    CREATE_INDEX,
    GET_INDEX_HISTORY,
    LIST_READY_INDEXES,
    WS_INSERT_HISTORY,
    FIND_INDEXES
} from "../../app/actionTypes";
import {
    wsInsertHistory,
    wsInsertIndex,
    wsUpdateIndex,
    listReadyIndexes,
    getIndex,
    getUnbuilt,
    createIndex,
    getIndexHistory,
    findIndexes
} from "../actions";

describe("Index Action Creators", () => {
    it("wsInsertHistory() should return action to insert history via websocket", () => {
        const data = { foo: "bar" };
        const result = wsInsertHistory(data);
        expect(result).toEqual({
            type: WS_INSERT_HISTORY,
            data
        });
    });

    it("wsInsertIndex() should return action to insert an index via websocket", () => {
        const data = { foo: "bar" };
        const result = wsInsertIndex(data);
        expect(result).toEqual({
            type: WS_INSERT_INDEX,
            data
        });
    });

    it("wsUpdateIndex() should return action to update an index via websocket", () => {
        const data = { foo: "baz" };
        const result = wsUpdateIndex(data);
        expect(result).toEqual({
            type: WS_UPDATE_INDEX,
            data
        });
    });

    it("findIndexes() should return action to get a specific page of indexes", () => {
        const refId = "foo";
        const term = "bar";
        const page = 3;
        const result = findIndexes(refId, term, page);
        expect(result).toEqual({
            type: FIND_INDEXES.REQUESTED,
            refId,
            term,
            page
        });
    });

    it("listReadyIndexes() should return action to get a list of all ready indexes", () => {
        const result = listReadyIndexes();
        expect(result).toEqual({ type: LIST_READY_INDEXES.REQUESTED });
    });

    it("getIndex() should return action to get a specific index version", () => {
        const indexId = "foo";
        const result = getIndex(indexId);
        expect(result).toEqual({
            type: GET_INDEX.REQUESTED,
            indexId
        });
    });

    it("getUnbuilt() should return action to get unbuilt changes for a refId", () => {
        const refId = "foo";
        const result = getUnbuilt(refId);
        expect(result).toEqual({
            type: GET_UNBUILT.REQUESTED,
            refId
        });
    });

    it("createIndex() should return action to create index for a refId", () => {
        const refId = "foo";
        const result = createIndex(refId);
        expect(result).toEqual({
            type: CREATE_INDEX.REQUESTED,
            refId
        });
    });

    it("getIndexHistory() should return action to retrieve a page of history for an indexId", () => {
        const indexId = "foo";
        const page = 1;
        const result = getIndexHistory(indexId, page);
        expect(result).toEqual({
            type: GET_INDEX_HISTORY.REQUESTED,
            indexId,
            page
        });
    });
});

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

describe("Indexes Action Creators:", () => {
    it("wsInsertHistory: returns action with websocket history insert data", () => {
        const data = { foo: "bar" };
        const result = wsInsertHistory(data);
        expect(result).toEqual({
            type: WS_INSERT_HISTORY,
            data
        });
    });

    it("wsInsertIndex: returns action to insert an entry via websocket", () => {
        const data = { foo: "bar" };
        const result = wsInsertIndex(data);
        expect(result).toEqual({
            type: WS_INSERT_INDEX,
            data
        });
    });

    it("wsUpdateIndex: returns action to update an entry via websocket", () => {
        const data = { foo: "baz" };
        const result = wsUpdateIndex(data);
        expect(result).toEqual({
            type: WS_UPDATE_INDEX,
            data
        });
    });

    it("findIndexes: returns action to get a specific page of indexes", () => {
        const refId = "123abc";
        const term = "foo";
        const page = 3;
        const result = findIndexes(refId, term, page);
        expect(result).toEqual({
            type: FIND_INDEXES.REQUESTED,
            refId,
            term,
            page
        });
    });

    it("listReadyIndexes: returns action to get a list of ready indexes", () => {
        const result = listReadyIndexes();
        expect(result).toEqual({ type: LIST_READY_INDEXES.REQUESTED });
    });

    it("getIndex: returns action to get specific index version", () => {
        const indexId = "abc123";
        const result = getIndex(indexId);
        expect(result).toEqual({
            type: GET_INDEX.REQUESTED,
            indexId
        });
    });

    it("getUnbuilt: returns simple action", () => {
        const refId = "123abc";
        const result = getUnbuilt(refId);
        expect(result).toEqual({
            type: GET_UNBUILT.REQUESTED,
            refId
        });
    });

    it("createIndex: returns simple action", () => {
        const refId = "123abc";
        const result = createIndex(refId);
        expect(result).toEqual({
            type: CREATE_INDEX.REQUESTED,
            refId
        });
    });

    it("getIndexHistory: returns action to retrieve the index changes history", () => {
        const indexId = "abc123";
        const page = "1";
        const result = getIndexHistory(indexId, page);
        expect(result).toEqual({
            type: GET_INDEX_HISTORY.REQUESTED,
            indexId,
            page
        });
    });
});

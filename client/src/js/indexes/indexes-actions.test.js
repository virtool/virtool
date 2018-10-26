import {
    WS_INSERT_INDEX,
    WS_UPDATE_INDEX,
    LIST_INDEXES,
    GET_INDEX,
    GET_UNBUILT,
    CREATE_INDEX,
    GET_INDEX_HISTORY,
    LIST_READY_INDEXES,
    WS_INSERT_HISTORY
} from "../actionTypes";
import {
    wsInsertHistory,
    wsInsertIndex,
    wsUpdateIndex,
    listIndexes,
    listReadyIndexes,
    getIndex,
    getUnbuilt,
    createIndex,
    getIndexHistory
} from "./actions";

describe("Indexes Action Creators:", () => {
    let data;
    let result;
    let expected;

    it("wsInsertHistory: returns action with websocket history insert data", () => {
        data = { foo: "bar" };
        result = wsInsertHistory(data);
        expected = {
            type: WS_INSERT_HISTORY,
            data
        };
        expect(result).toEqual(expected);
    });

    it("wsInsertIndex: returns action to insert an entry via websocket", () => {
        data = { foo: "bar" };
        result = wsInsertIndex(data);
        expected = {
            type: WS_INSERT_INDEX,
            data
        };
        expect(result).toEqual(expected);
    });

    it("wsUpdateIndex: returns action to update an entry via websocket", () => {
        data = { foo: "baz" };
        result = wsUpdateIndex(data);
        expected = {
            type: WS_UPDATE_INDEX,
            data
        };
        expect(result).toEqual(expected);
    });

    it("listIndexes: returns action to get a specific page of indexes", () => {
        const refId = "123abc";
        const page = 3;
        result = listIndexes(refId, page);
        expected = {
            type: LIST_INDEXES.REQUESTED,
            refId,
            page
        };
        expect(result).toEqual(expected);
    });

    it("listReadyIndexes: returns action to get a list of ready indexes", () => {
        result = listReadyIndexes();
        expected = { type: LIST_READY_INDEXES.REQUESTED };
        expect(result).toEqual(expected);
    });

    it("getIndex: returns action to get specific index version", () => {
        const indexId = "abc123";
        result = getIndex(indexId);
        expected = {
            type: GET_INDEX.REQUESTED,
            indexId
        };
        expect(result).toEqual(expected);
    });

    it("getUnbuilt: returns simple action", () => {
        const refId = "123abc";
        result = getUnbuilt(refId);
        expected = {
            type: GET_UNBUILT.REQUESTED,
            refId
        };
        expect(result).toEqual(expected);
    });

    it("createIndex: returns simple action", () => {
        const refId = "123abc";
        result = createIndex(refId);
        expected = {
            type: CREATE_INDEX.REQUESTED,
            refId
        };
        expect(result).toEqual(expected);
    });

    it("getIndexHistory: returns action to retrieve the index changes history", () => {
        const indexId = "abc123";
        const page = "1";
        result = getIndexHistory(indexId, page);
        expected = {
            type: GET_INDEX_HISTORY.REQUESTED,
            indexId,
            page
        };
        expect(result).toEqual(expected);
    });
});

import {
    findIndexes,
    getIndex,
    getUnbuilt,
    createIndex,
    getIndexHistory
} from "./actions";
import {
    FIND_INDEXES,
    GET_INDEX,
    GET_UNBUILT,
    CREATE_INDEX,
    GET_INDEX_HISTORY
} from "../actionTypes";

describe("Indexes Action Creators:", () => {

    it("findIndexes: returns simple action", () => {
        const result = findIndexes();
        const expected = {
            type: "FIND_INDEXES_REQUESTED"
        };

        expect(result).toEqual(expected);
    });

    it("getIndex: returns action to get specific index version", () => {
        const indexVersion = "3";
        const result = getIndex(indexVersion);
        const expected = {
            type: "GET_INDEX_REQUESTED",
            indexVersion
        };

        expect(result).toEqual(expected);
    });

    it("getUnbuilt: returns simple action", () => {
        const result = getUnbuilt();
        const expected = {
            type: "GET_UNBUILT_REQUESTED"
        };

        expect(result).toEqual(expected);
    });

    it("createIndex: returns simple action", () => {
        const result = createIndex();
        const expected = {
            type: "CREATE_INDEX_REQUESTED"
        };

        expect(result).toEqual(expected);
    });

    it("getIndexHistory: returns action to retrieve the index changes history", () => {
        const indexVersion = "3";
        const page = "1";
        const result = getIndexHistory(indexVersion, page);
        const expected = {
            type: "GET_INDEX_HISTORY_REQUESTED",
            indexVersion,
            page
        };

        expect(result).toEqual(expected);
    });

});

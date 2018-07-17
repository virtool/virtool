import {
    wsInsertSubtraction,
    wsUpdateSubtraction,
    wsRemoveSubtraction,
    listSubtractions,
    filterSubtractions,
    getSubtraction,
    createSubtraction,
    updateSubtraction,
    removeSubtraction
} from "./actions";
import {
    WS_INSERT_SUBTRACTION,
    WS_UPDATE_SUBTRACTION,
    WS_REMOVE_SUBTRACTION,
    LIST_SUBTRACTIONS,
    FILTER_SUBTRACTIONS,
    GET_SUBTRACTION,
    UPDATE_SUBTRACTION,
    CREATE_SUBTRACTION,
    REMOVE_SUBTRACTION
} from "../actionTypes";

describe("Subtraction Action Creators:", () => {

    it("wsInsertSubtraction: returns action of websocket insert subtraction data", () => {
        const data = {
            file: {
                id: "abc123-test.171",
                name: "test.171"
            },
            id: "testSubtraction",
            job: { id: "jobId" },
            ready: false
        };
        const result = wsInsertSubtraction(data);
        const expected = {
            type: WS_INSERT_SUBTRACTION,
            data
        };

        expect(result).toEqual(expected);
    });

    it("wsUpdateSubtraction: returns action of websocket update subtraction data", () => {
        const data = {
            file: {
                id: "abc123-test.171",
                name: "test.171"
            },
            id: "testSubtraction",
            job: { id: "jobId" },
            ready: true
        };
        const result = wsUpdateSubtraction(data);
        const expected = {
            type: WS_UPDATE_SUBTRACTION,
            data
        };

        expect(result).toEqual(expected);
    });

    it("wsRemoveSubtraction: returns action of websocket remove subtraction data", () => {
        const data = ["testSubtraction"];
        const result = wsRemoveSubtraction(data);
        const expected = {
            type: WS_REMOVE_SUBTRACTION,
            data
        };

        expect(result).toEqual(expected);
    });

    it("listSubtractions: returns action to retrieve page from subtractions documents", () => {
        const page = 123;
        const result = listSubtractions(page);
        const expected = {
            type: LIST_SUBTRACTIONS.REQUESTED,
            page
        };

        expect(result).toEqual(expected);
    });

    it("filterSubtractions: returns action to retrieve filtered subtraction documents", () => {
        const term = "test";
        const result = filterSubtractions(term);
        const expected = {
            type: FILTER_SUBTRACTIONS.REQUESTED,
            term
        };

        expect(result).toEqual(expected);
    });

    it("getSubtraction: returns action to retrieve a subtraction", () => {
        const subtractionId = "testerid";
        const result = getSubtraction(subtractionId);
        const expected = {
            type: GET_SUBTRACTION.REQUESTED,
            subtractionId
        };

        expect(result).toEqual(expected);
    });

    it("createSubtraction: returns action to create a subtraction", () => {
        const subtractionId = "testerid";
        const fileId = "fastafile";
        const nickname = "nickname";
        const result = createSubtraction(subtractionId, fileId, nickname);
        const expected = {
            type: CREATE_SUBTRACTION.REQUESTED,
            subtractionId,
            fileId,
            nickname
        };

        expect(result).toEqual(expected);
    });

    it("updateSubtraction: returns action to modify a subtraction", () => {
        const subtractionId = "testerid";
        const nickname = "nickname";
        const result = updateSubtraction(subtractionId, nickname);
        const expected = {
            type: UPDATE_SUBTRACTION.REQUESTED,
            subtractionId,
            nickname
        };

        expect(result).toEqual(expected);
    });

    it("removeSubtraction: returns action to remove a subtraction", () => {
        const subtractionId = "testerid";
        const result = removeSubtraction(subtractionId);
        const expected = {
            type: REMOVE_SUBTRACTION.REQUESTED,
            subtractionId
        };

        expect(result).toEqual(expected);
    });

});

import {
    WS_INSERT_SUBTRACTION,
    WS_UPDATE_SUBTRACTION,
    WS_REMOVE_SUBTRACTION,
    GET_SUBTRACTION,
    UPDATE_SUBTRACTION,
    CREATE_SUBTRACTION,
    REMOVE_SUBTRACTION,
    FIND_SUBTRACTIONS
} from "../../app/actionTypes";
import {
    wsInsertSubtraction,
    wsUpdateSubtraction,
    wsRemoveSubtraction,
    getSubtraction,
    createSubtraction,
    updateSubtraction,
    removeSubtraction,
    findSubtractions
} from "../actions";

describe("Subtraction Action Creators:", () => {
    const subtractionId = "foobar";

    it("wsInsertSubtraction", () => {
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
        expect(result).toEqual({
            type: WS_INSERT_SUBTRACTION,
            data
        });
    });

    it("wsUpdateSubtraction", () => {
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
        expect(result).toEqual({
            type: WS_UPDATE_SUBTRACTION,
            data
        });
    });

    it("wsRemoveSubtraction", () => {
        const data = ["testSubtraction"];
        const result = wsRemoveSubtraction(data);
        expect(result).toEqual({
            type: WS_REMOVE_SUBTRACTION,
            data
        });
    });

    it("findSubtractions", () => {
        const term = "foo";
        const page = 123;
        const result = findSubtractions(term, page);
        expect(result).toEqual({
            type: FIND_SUBTRACTIONS.REQUESTED,
            term,
            page
        });
    });

    it("getSubtraction", () => {
        const result = getSubtraction(subtractionId);
        expect(result).toEqual({
            type: GET_SUBTRACTION.REQUESTED,
            subtractionId
        });
    });

    it("createSubtraction", () => {
        const fileId = "fasta";
        const nickname = "nickname";
        const result = createSubtraction(subtractionId, fileId, nickname);
        expect(result).toEqual({
            type: CREATE_SUBTRACTION.REQUESTED,
            subtractionId,
            fileId,
            nickname
        });
    });

    it("updateSubtraction", () => {
        const nickname = "nickname";
        const result = updateSubtraction(subtractionId, nickname);
        expect(result).toEqual({
            type: UPDATE_SUBTRACTION.REQUESTED,
            subtractionId,
            nickname
        });
    });

    it("removeSubtraction", () => {
        const result = removeSubtraction(subtractionId);
        expect(result).toEqual({
            type: REMOVE_SUBTRACTION.REQUESTED,
            subtractionId
        });
    });
});

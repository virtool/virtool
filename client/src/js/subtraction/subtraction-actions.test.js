import {
    getSubtraction,
    createSubtraction,
    updateSubtraction,
    removeSubtraction
} from "./actions";
import {
    GET_SUBTRACTION,
    UPDATE_SUBTRACTION,
    CREATE_SUBTRACTION,
    REMOVE_SUBTRACTION
} from "../actionTypes";

describe("Subtraction Action Creators:", () => {

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

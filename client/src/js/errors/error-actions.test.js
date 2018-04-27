import { clearError } from "./actions";
import { CLEAR_ERROR } from "../actionTypes";

describe("Errors Action Creators:", () => {
    it("should create an action to clear specific error", () => {
        const error = "TARGET_ERROR";
        const result = clearError(error);
        const expected = {
            type: CLEAR_ERROR,
            error
        };

        expect(result).toEqual(expected);
    });
});

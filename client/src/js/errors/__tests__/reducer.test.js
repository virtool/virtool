import { reportAPIError } from "../../utils/utils";
import reducer, { checkActionFailed, getErrorName, resetErrorName } from "../reducer";

// Must mock target modules before imports to use in testing
jest.mock("../../utils/utils");

describe("reducer()", () => {
    it("should return the initial state (null)", () => {
        const result = reducer(undefined, {});
        expect(result).toBe(null);
    });

    it("should return the given state on other action types", () => {
        const action = {
            type: "UNHANDLED_ACTION"
        };
        const result = reducer({}, action);

        expect(result).toEqual({});
    });

    it.each([
        "CREATE_SAMPLE",
        "UPDATE_SAMPLE",
        "CREATE_OTU",
        "EDIT_OTU",
        "ADD_ISOLATE",
        "EDIT_ISOLATE",
        "ADD_SEQUENCE",
        "EDIT_SEQUENCE",
        "CREATE_INDEX",
        "CREATE_SUBTRACTION",
        "UPDATE_ACCOUNT",
        "CHANGE_ACCOUNT_PASSWORD",
        "CREATE_USER",
        "EDIT_USER",
        "CREATE_GROUP"
    ])("should handle %p_FAILED actions", actionTypePrefix => {
        const state = {};
        const action = {
            type: `${actionTypePrefix}_FAILED`,
            status: 409,
            message: "There was an error"
        };
        const result = reducer(state, action);

        const expected = {
            [`${actionTypePrefix}_ERROR`]: {
                status: 409,
                message: "There was an error"
            }
        };

        expect(result).toEqual(expected);
    });

    it("should report uncaught errors and return state", () => {
        const state = {};
        const action = {
            type: "TEST_FAILED",
            status: 400,
            message: "test action failed"
        };
        const result = reducer(state, action);

        expect(reportAPIError).toHaveBeenCalledWith(action);
        expect(result).toEqual(state);
    });

    it("should clear error when same type action is requested", () => {
        const state = {
            CREATE_SAMPLE_ERROR: {
                status: 409,
                message: "test action failed previously"
            }
        };
        const action = {
            type: "CREATE_SAMPLE_REQUESTED",
            status: 200,
            message: "requesting same action again"
        };
        const result = reducer(state, action);

        expect(result).toEqual({
            CREATE_SAMPLE_ERROR: null
        });
        expect(reducer({}, action)).toEqual({});
    });

    it("should clear error on CLEAR_ERROR action", () => {
        const state = {
            CREATE_SAMPLE_ERROR: {
                status: 409,
                message: "test action failed previously"
            }
        };
        const action = {
            type: "CLEAR_ERROR",
            error: "CREATE_SAMPLE_ERROR"
        };
        const result = reducer(state, action);
        const expected = {
            CREATE_SAMPLE_ERROR: null
        };
        expect(result).toEqual(expected);
        expect(reducer({}, action)).toEqual(expected);
    });
});

describe("checkActionFailed()", () => {
    it("should return action if action.type ends in '_FAILED'", () => {
        const action = { type: "TEST_FAILED" };
        const result = checkActionFailed(action);

        expect(result).toEqual({ type: "TEST_FAILED" });
    });

    it("should return false if action.type does not end in '_FAILED'", () => {
        const action = { type: "TEST_OTHER" };
        const result = checkActionFailed(action);

        expect(result).toBe(false);
    });
});

describe("getErrorName()", () => {
    it("should return '_FAILED' action with '_ERROR' suffix", () => {
        const action = { type: "TEST_FAILED" };
        const result = getErrorName(action);

        expect(result).toEqual("TEST_ERROR");
    });

    it("should return action.type otherwise", () => {
        const action = { type: "TEST_OTHER" };
        const result = getErrorName(action);

        expect(result).toBe("TEST_OTHER");
    });
});

describe("resetErrorName()", () => {
    it("should return '_REQUESTED' action with '_ERROR' suffix", () => {
        const action = { type: "TEST_REQUESTED" };
        const result = resetErrorName(action);

        expect(result).toEqual("TEST_ERROR");
    });

    it("should return undefined otherwise", () => {
        const action = { type: "TEST_OTHER" };
        const result = resetErrorName(action);

        expect(result).toBe(undefined);
    });
});

import reducer, {
    checkActionFailed,
    getErrorName,
    resetErrorName
} from "./reducer";
import {
    CLEAR_ERROR,
    CREATE_SAMPLE,
    UPDATE_SAMPLE,
    CREATE_VIRUS,
    EDIT_VIRUS,
    ADD_ISOLATE,
    EDIT_ISOLATE,
    ADD_SEQUENCE,
    EDIT_SEQUENCE,
    CREATE_INDEX,
    CREATE_SUBTRACTION,
    UPDATE_ACCOUNT,
    CHANGE_ACCOUNT_PASSWORD,
    CREATE_USER,
    EDIT_USER,
    CREATE_GROUP
} from "../actionTypes";

// Must mock target modules before imports to use in testing
jest.mock("../utils");
import * as utils from "../utils";

describe("Errors Reducer", () => {

    let state;
    let action;
    let result;
    let expected;

    it("should return the initial state (null)", () => {
        result = reducer(undefined, {});

        expect(result).toBe(null);
    });

    it("should handle target _FAILED actions", () => {
        state = {};
        action = {
            type: "CREATE_SAMPLE_FAILED",
            status: 409,
            message: "test action failed"
        };
        result = reducer(state, action);
        expected = {
            CREATE_SAMPLE_ERROR: {
                status: 409,
                message: "test action failed"
            }
        };

        expect(result).toEqual(expected);
    });

    it("should report uncaught errors and return state", () => {
        const spy = jest.spyOn(utils, "reportAPIError");

        state = {};
        action = {
            type: "TEST_FAILED",
            status: 400,
            message: "test action failed"
        };
        result = reducer(state, action);
        expected = state;

        expect(spy).toHaveBeenCalledWith(action);
        expect(result).toEqual(state);

        // Reset mocks and restore modules to non-mocked versions
        spy.mockReset();
        spy.mockRestore();
    });

    it("should clear error when same type action is requested", () => {
        state = {
            CREATE_SAMPLE_ERROR: {
                status: 409,
                message: "test action failed previously"
            }
        };
        action = {
            type: "CREATE_SAMPLE_REQUESTED",
            status: 200,
            message: "requesting same action again"
        };
        result = reducer(state, action);
        expected = {
            CREATE_SAMPLE_ERROR: null
        };

        expect(result).toEqual(expected);
        expect(reducer({}, action)).toEqual({});
    });

    it("should clear error on CLEAR_ERROR action", () => {
        state = {
            CREATE_SAMPLE_ERROR: {
                status: 409,
                message: "test action failed previously"
            }
        };
        action = {
            type: "CLEAR_ERROR",
            error: "CREATE_SAMPLE_ERROR"
        };
        result = reducer(state, action);
        expected = {
            CREATE_SAMPLE_ERROR: null
        };

        expect(result).toEqual(expected);
        expect(reducer({}, action)).toEqual(expected);
    });

    describe("Errors Reducer Helper Functions", () => {

        describe("checkActionFailed", () => {
            it("returns action if action.type ends in '_FAILED'", () => {
                action = { type: "TEST_FAILED" };
                result = checkActionFailed(action);
                expected = { type: "TEST_FAILED" };

                expect(result).toEqual(expected);
            });

            it("returns false if action.type does not end in '_FAILED'", () => {
                action = { type: "TEST_OTHER" };
                result = checkActionFailed(action);

                expect(result).toBe(false);
            });
        });

        describe("getErrorName", () => {
            it("returns '_FAILED' action with '_ERROR' suffix", () => {
                action = { type: "TEST_FAILED" };
                result = getErrorName(action);
                expected = "TEST_ERROR";

                expect(result).toEqual(expected);
            });

            it("return action.type otherwise", () => {
                action = { type: "TEST_OTHER" };
                result = getErrorName(action);
                expected = "TEST_OTHER";

                expect(result).toBe(expected);
            });
        });

        describe("resetErrorName", () => {
            it("returns '_REQUESTED' action with '_ERROR' suffix", () => {
                action = { type: "TEST_REQUESTED" };
                result = resetErrorName(action);
                expected = "TEST_ERROR";

                expect(result).toEqual(expected);
            });

            it("returns undefined otherwise", () => {
                action = { type: "TEST_OTHER" };
                result = resetErrorName(action);

                expect(result).toBe(undefined);
            });
        });

    });
});

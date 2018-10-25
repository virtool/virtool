import { WS_UPDATE_PROCESS, WS_UPDATE_STATUS, GET_SOFTWARE_UPDATES } from "../actionTypes";
import reducer, { initialState as reducerInitialState } from "./reducer";

describe("Updates Reducer", () => {
    const initialState = reducerInitialState;
    let state;
    let action;
    let result;
    let expected;

    it("should return the initial state on first pass", () => {
        result = reducer(undefined, {});
        expected = initialState;

        expect(result).toEqual(expected);
    });

    it("should return the given state on other action types", () => {
        action = {
            type: "UNHANDLED_ACTION"
        };
        result = reducer(initialState, action);
        expected = initialState;

        expect(result).toEqual(expected);
    });

    describe("should handle WS_UPDATE_PROCESS", () => {
        it("when action id matches process.id in state, update process with websocket data", () => {
            state = { process: { id: "123abc" } };
            action = { type: WS_UPDATE_PROCESS, data: { id: "123abc" } };
            result = reducer(state, action);
            expected = { process: action.data };
            expect(result).toEqual(expected);
        });

        it("otherwise return state", () => {
            state = {};
            action = { type: WS_UPDATE_PROCESS, data: { id: "test" } };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });
    });

    describe("should handle WS_UPDATE_STATUS", () => {
        it("when [action.data.id='software_update'], return with software data", () => {
            state = {};
            action = {
                type: WS_UPDATE_STATUS,
                data: {
                    id: "software"
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                ...action.data
            };

            expect(result).toEqual(expected);
        });

        it("otherwise return state", () => {
            state = {};
            action = {
                type: WS_UPDATE_STATUS,
                data: {
                    id: "not_software_update"
                }
            };
            result = reducer(state, action);
            expected = state;

            expect(result).toEqual(expected);
        });
    });

    it("should handle GET_SOFTWARE_UPDATES_SUCCEEDED", () => {
        state = {};

        action = {
            type: GET_SOFTWARE_UPDATES.SUCCEEDED,
            data: {
                id: "test"
            }
        };

        result = reducer(state, action);

        expected = {
            id: "test"
        };

        expect(result).toEqual(expected);
    });
});

import { GET_SOFTWARE_UPDATES, WS_UPDATE_STATUS, WS_UPDATE_TASK } from "../../app/actionTypes";
import reducer, { initialState } from "../reducer";

describe("Updates Reducer", () => {
    it("should return the initial state on first pass", () => {
        const result = reducer(undefined, {});
        expect(result).toEqual(initialState);
    });

    it("should return the given state on other action types", () => {
        const action = {
            type: "UNHANDLED_ACTION"
        };
        const result = reducer(initialState, action);
        expect(result).toEqual(initialState);
    });

    describe("should handle WS_UPDATE_TASK", () => {
        it("when action id matches task.id in state, update task with websocket data", () => {
            const state = { task: { id: "123abc" } };
            const action = { type: WS_UPDATE_TASK, data: { id: "123abc" } };
            const result = reducer(state, action);
            expect(result).toEqual({ task: action.data });
        });

        it("otherwise return state", () => {
            const state = {};
            const action = { type: WS_UPDATE_TASK, data: { id: "test" } };
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });
    });

    describe("should handle WS_UPDATE_STATUS", () => {
        it("when [action.data.id='software_update'], return with software data", () => {
            const action = {
                type: WS_UPDATE_STATUS,
                data: {
                    id: "software",
                    progress: 5
                }
            };
            const result = reducer({}, action);
            expect(result).toEqual(action.data);
        });

        it("otherwise return state", () => {
            const state = {};
            const action = {
                type: WS_UPDATE_STATUS,
                data: {
                    id: "not_software_update"
                }
            };
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });
    });

    it("should handle GET_SOFTWARE_UPDATES_SUCCEEDED", () => {
        const action = {
            type: GET_SOFTWARE_UPDATES.SUCCEEDED,
            data: {
                id: "test"
            }
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            id: "test"
        });
    });
});

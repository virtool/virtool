import { WS_INSERT_PROCESS, WS_UPDATE_PROCESS, LIST_PROCESSES, GET_PROCESS } from "../../app/actionTypes";
import reducer, { initialState as reducerInitialState } from "../reducer";

describe("Processes Reducer", () => {
    it("should return the initial state on first pass", () => {
        const result = reducer(undefined, {});
        expect(result).toEqual(reducerInitialState);
    });

    it("should return the given state on other action types", () => {
        const action = { type: "UNHANDLED_ACTION" };
        const result = reducer(reducerInitialState, action);
        expect(result).toEqual(reducerInitialState);
    });

    it("should handle WS_INSERT_PROCESS", () => {
        const state = { documents: [] };
        const action = { type: WS_INSERT_PROCESS, data: { id: "test" } };
        const result = reducer(state, action);
        expect(result).toEqual({ documents: [{ id: "test" }] });
    });

    it("should handle WS_UPDATE_PROCESS", () => {
        const state = { documents: [{ id: "test", foo: "bar" }] };
        const action = { type: WS_UPDATE_PROCESS, data: { id: "test", foo: "baz" } };
        const result = reducer(state, action);
        expect(result).toEqual({ documents: [{ id: "test", foo: "baz" }] });
    });

    it("should handle LIST_PROCESSES_SUCCEEDED", () => {
        const state = { documents: [] };
        const action = {
            type: LIST_PROCESSES.SUCCEEDED,
            data: [{ id: "test1" }, { id: "test2" }, { id: "test3" }]
        };
        const result = reducer(state, action);
        expect(result).toEqual({ documents: [...action.data] });
    });

    it("should handle GET_PROCESS_REQUESTED", () => {
        const state = { detail: { foo: "bar" } };
        const action = { type: GET_PROCESS.REQUESTED };
        const result = reducer(state, action);
        expect(result).toEqual({ detail: null });
    });

    it("should handle GET_PROCESS_SUCCEEDED", () => {
        const state = { detail: null };
        const action = { type: GET_PROCESS.SUCCEEDED, data: { foo: "bar" } };
        const result = reducer(state, action);
        expect(result).toEqual({ detail: { foo: "bar" } });
    });
});

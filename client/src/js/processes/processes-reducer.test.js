import { WS_INSERT_PROCESS, WS_UPDATE_PROCESS, LIST_PROCESSES, GET_PROCESS } from "../actionTypes";
import reducer, { initialState as reducerInitialState } from "./reducer";

describe("Processes Reducer", () => {
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
        action = { type: "UNHANDLED_ACTION" };
        result = reducer(initialState, action);
        expected = initialState;
        expect(result).toEqual(expected);
    });

    it("should handle WS_INSERT_PROCESS", () => {
        state = { documents: [] };
        action = { type: WS_INSERT_PROCESS, data: { id: "test" } };
        result = reducer(state, action);
        expected = { documents: [{ id: "test" }] };
        expect(result).toEqual(expected);
    });

    it("should handle WS_UPDATE_PROCESS", () => {
        state = { documents: [{ id: "test", foo: "bar" }] };
        action = { type: WS_UPDATE_PROCESS, data: { id: "test", foo: "baz" } };
        result = reducer(state, action);
        expected = { documents: [{ id: "test", foo: "baz" }] };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_PROCESSES_SUCCEEDED", () => {
        state = { documents: [] };
        action = {
            type: LIST_PROCESSES.SUCCEEDED,
            data: [{ id: "test1" }, { id: "test2" }, { id: "test3" }]
        };
        result = reducer(state, action);
        expected = { documents: [...action.data] };
        expect(result).toEqual(expected);
    });

    it("should handle GET_PROCESS_REQUESTED", () => {
        state = { detail: { foo: "bar" } };
        action = { type: GET_PROCESS.REQUESTED };
        result = reducer(state, action);
        expected = { detail: null };
        expect(result).toEqual(expected);
    });

    it("should handle GET_PROCESS_SUCCEEDED", () => {
        state = { detail: null };
        action = { type: GET_PROCESS.SUCCEEDED, data: { foo: "bar" } };
        result = reducer(state, action);
        expected = { detail: { foo: "bar" } };
        expect(result).toEqual(expected);
    });

    describe("Helper functions: updateProcesses()", () => {
        it("if state.documents is an empty array, add entry", () => {
            state = { documents: [] };
            action = {
                type: WS_UPDATE_PROCESS,
                data: { id: "test", foo: "bar" }
            };
            result = updateProcesses(state, action);
            expected = { documents: [{ id: "test", foo: "bar" }] };
            expect(result).toEqual(expected);
        });

        it("if state.documents is not empty, update target entry", () => {
            state = {
                documents: [{ id: "test", foo: "bar" }, { id: "entry", foo: "bar" }]
            };
            action = {
                type: WS_UPDATE_PROCESS,
                data: { id: "test", test: "update" }
            };
            result = updateProcesses(state, action);
            expected = {
                documents: [{ id: "test", foo: "bar", test: "update" }, { id: "entry", foo: "bar" }]
            };
            expect(result).toEqual(expected);
        });
    });
});

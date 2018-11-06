import {
    WS_INSERT_INDEX,
    WS_UPDATE_INDEX,
    GET_INDEX,
    GET_UNBUILT,
    GET_INDEX_HISTORY,
    WS_INSERT_HISTORY,
    FIND_INDEXES
} from "../../app/actionTypes";
import reducer, { initialState as reducerInitialState } from "../reducer";

describe("Indexes Reducer", () => {
    it("should return the initial state on first pass", () => {
        const result = reducer(undefined, {});
        expect(result).toEqual(reducerInitialState);
    });

    it("should return the given state on other action types", () => {
        const action = {
            type: "UNHANDLED_ACTION"
        };
        const result = reducer(reducerInitialState, action);
        expect(result).toEqual(reducerInitialState);
    });

    describe("should handle WS_INSERT_HISTORY", () => {
        it("increment modified_otu_count if insert into current ref", () => {
            const state = { refId: "foo", modified_otu_count: 3 };
            const action = {
                type: WS_INSERT_HISTORY,
                data: { reference: { id: "foo" } }
            };
            const result = reducer(state, action);
            expect(result).toEqual({ ...state, modified_otu_count: 4 });
        });

        it("if insert occurs in different reference, return state", () => {
            const state = { refId: "foo" };
            const action = {
                type: WS_INSERT_HISTORY,
                data: { reference: { id: "bar" } }
            };
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });
    });

    describe("should handle WS_INSERT_INDEX", () => {
        it("return state if list empty or insert in different ref", () => {
            const state = { refId: "foo" };
            const action = {
                type: WS_INSERT_INDEX,
                data: {
                    reference: { id: "bar" }
                }
            };
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });

        it("if insert is for current reference index, insert into list", () => {
            const state = {
                refId: "foo",
                documents: [],
                page: 1
            };
            const action = {
                type: WS_INSERT_INDEX,
                data: {
                    reference: { id: "foo" },
                    version: 0
                }
            };
            const result = reducer(state, action);
            expect(result).toEqual({
                ...state,
                documents: [{ ...action.data }]
            });
        });
    });

    describe("should handle WS_UPDATE_INDEX", () => {
        it("if update is for a different reference index, return state", () => {
            const state = { refId: "foo" };
            const action = {
                type: WS_UPDATE_INDEX,
                data: { reference: { id: "bar" } }
            };
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });

        it("if update is for current reference, update corresponding entry", () => {
            const state = {
                documents: [{ id: "test", reference: { id: "foo" }, version: 0 }],
                refId: "foo"
            };
            const action = {
                type: WS_UPDATE_INDEX,
                data: {
                    id: "test",
                    reference: { id: "foo" },
                    version: 1
                }
            };
            const result = reducer(state, action);
            expect(result).toEqual({
                ...state,
                documents: [{ id: "test", reference: { id: "foo" }, version: 1 }]
            });
        });
    });

    it("should handle FIND_INDEXES_REQUESTED", () => {
        const state = {};
        const term = "bar";
        const action = {
            type: FIND_INDEXES.REQUESTED,
            refId: "foo",
            term,
            page: 4
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            term
        });
    });

    it("should handle FIND_INDEXES_SUCCEEDED", () => {
        const state = {
            documents: null,
            page: 1
        };
        const action = {
            type: FIND_INDEXES.SUCCEEDED,
            data: {
                documents: [{ id: "1" }],
                page: 2
            }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            documents: [{ id: "1" }],
            page: 2
        });
    });

    it("should handle GET_INDEX_REQUESTED", () => {
        const state = {};
        const action = { type: GET_INDEX.REQUESTED };
        const result = reducer(state, action);
        expect(result).toEqual({ detail: null });
    });

    it("should handle GET_INDEX_SUCCEEDED", () => {
        const state = { detail: null };
        const action = {
            type: GET_INDEX.SUCCEEDED,
            data: { id: "foo", version: 3 }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            detail: action.data
        });
    });

    it("should handle GET_UNBUILT_SUCCEEDED", () => {
        const state = {};
        const action = {
            type: GET_UNBUILT.SUCCEEDED,
            data: {}
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            unbuilt: action.data
        });
    });

    it("should handle GET_INDEX_HISTORY_SUCCEEDED", () => {
        const state = { history: { documents: null } };
        const action = {
            type: GET_INDEX_HISTORY.SUCCEEDED,
            data: { documents: [{ foo: "bar" }], page: 1, per_page: 3 }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            history: {
                ...action.data
            }
        });
    });

    it("should handle GET_INDEX_HISTORY_FAILED", () => {
        const state = { history: null };
        const action = { type: GET_INDEX_HISTORY.FAILED };
        const result = reducer(state, action);
        expect(result).toEqual({ history: { isLoading: false, errorLoad: true } });
    });
});

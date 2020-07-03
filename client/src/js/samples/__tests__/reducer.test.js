import {
    WS_INSERT_SAMPLE,
    WS_UPDATE_SAMPLE,
    WS_REMOVE_SAMPLE,
    GET_SAMPLE,
    UPDATE_SAMPLE,
    REMOVE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    SHOW_REMOVE_SAMPLE,
    HIDE_SAMPLE_MODAL,
    FIND_READ_FILES,
    FIND_SAMPLES,
    DESELECT_SAMPLES
} from "../../app/actionTypes";
import reducer, { initialState } from "../reducer";

describe("Samples Reducer", () => {
    it("should return initial state on first call", () => {
        const result = reducer(undefined, {});
        expect(result).toEqual(initialState);
    });

    it("should return the current state for unhandled actions", () => {
        const action = { type: "UNHANDLED_ACTION" };
        const result = reducer(initialState, action);
        expect(result).toEqual(initialState);
    });

    describe("should handle WS_INSERT_SAMPLE", () => {
        const action = {
            type: WS_INSERT_SAMPLE,
            data: {
                id: "abc123",
                name: "test"
            }
        };

        it("inserts entry when [documents=null]", () => {
            const state = { documents: null };
            const result = reducer(state, action);
            expect(result).toEqual({
                documents: [action.data]
            });
        });

        it("inserts entry into current list otherwise", () => {
            const state = { documents: [] };
            const result = reducer(state, action);
            expect(result).toEqual({
                documents: [action.data]
            });
        });
    });

    it("should handle WS_UPDATE_SAMPLE", () => {
        const state = {
            ...initialState,
            documents: [{ id: "foo", name: "Old" }]
        };
        const action = {
            type: WS_UPDATE_SAMPLE,
            data: {
                id: "foo",
                name: "New"
            }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            documents: [{ id: "foo", name: "New" }]
        });
    });

    it("should handle WS_REMOVE_SAMPLE", () => {
        const state = {
            ...initialState,
            documents: [{ id: "foo", name: "test" }]
        };
        const action = {
            type: WS_REMOVE_SAMPLE,
            data: ["foo"]
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            documents: []
        });
    });

    it("should handle FIND_SAMPLES_REQUESTED", () => {
        const term = "foo";
        const action = {
            type: FIND_SAMPLES.REQUESTED,
            term,
            page: 5
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            term
        });
    });

    it("should handle FIND_SAMPLES_SUCCEEDED", () => {
        const action = {
            type: FIND_SAMPLES.SUCCEEDED,
            data: { documents: [], page: 5 }
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            documents: [],
            page: 5
        });
    });

    it("should handle FIND_READ_FILES_SUCCEEDED", () => {
        const action = {
            type: FIND_READ_FILES.SUCCEEDED,
            data: {
                documents: [],
                found_count: 0,
                page: 1,
                page_count: 0,
                per_page: 500,
                total_count: 0
            }
        };
        const result = reducer(initialState, action);
        expect(result).toEqual({
            ...initialState,
            readFiles: action.data.documents
        });
    });

    it("should handle GET_SAMPLE_REQUESTED", () => {
        const action = {
            type: GET_SAMPLE.REQUESTED,
            sampleId: "test"
        };
        const result = reducer(initialState, action);
        expect(result).toEqual({
            ...initialState,
            detail: null
        });
    });

    it("should handle GET_SAMPLE_SUCCEEDED", () => {
        const action = {
            type: GET_SAMPLE.SUCCEEDED,
            data: {
                id: "123abc",
                name: "test"
            }
        };
        const result = reducer(initialState, action);
        expect(result).toEqual({
            ...initialState,
            detail: action.data
        });
    });

    it("should handle UPDATE_SAMPLE_SUCCEEDED", () => {
        const action = {
            type: UPDATE_SAMPLE.SUCCEEDED,
            data: {
                id: "123abc",
                name: "test"
            }
        };
        const result = reducer(initialState, action);
        expect(result).toEqual({
            ...initialState,
            detail: action.data
        });
    });

    it("should handle UPDATE_SAMPLE_RIGHTS_SUCCEEDED", () => {
        const state = {};
        const action = {
            type: UPDATE_SAMPLE_RIGHTS.SUCCEEDED,
            data: { foo: "bar" }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            detail: action.data
        });
    });

    it("should handle REMOVE_SAMPLE_SUCCEEDED", () => {
        const action = {
            type: REMOVE_SAMPLE.SUCCEEDED
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            detail: null
        });
    });

    it("should handle SHOW_REMOVE_SAMPLE", () => {
        const action = { type: SHOW_REMOVE_SAMPLE };
        const result = reducer({}, action);
        expect(result).toEqual({ showRemove: true });
    });

    it("should handle HIDE_SAMPLE_MODAL", () => {
        const action = { type: HIDE_SAMPLE_MODAL };
        const result = reducer({}, action);
        expect(result).toEqual({ showRemove: false });
    });

    it("should handle DESELECT_SAMPLES", () => {
        const action = { type: DESELECT_SAMPLES, sampleIds: ["foo", "bad"] };
        const state = { selected: ["foo", "bar", "bad", "baz"] };
        const result = reducer(state, action);
        expect(result).toEqual({
            selected: ["bar", "baz"]
        });
    });
});

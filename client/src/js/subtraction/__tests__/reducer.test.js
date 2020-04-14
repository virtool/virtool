import {
    WS_INSERT_SUBTRACTION,
    WS_UPDATE_SUBTRACTION,
    WS_REMOVE_SUBTRACTION,
    FIND_SUBTRACTIONS,
    GET_SUBTRACTION,
    EDIT_SUBTRACTION
} from "../../app/actionTypes";
import reducer, { initialState } from "../reducer";

describe("Subtraction Reducer", () => {
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

    describe("should handle WS_INSERT_SUBTRACTION", () => {
        const action = {
            type: WS_INSERT_SUBTRACTION,
            data: {
                id: "foo"
            }
        };

        it("inserts document if documents empty", () => {
            const state = { documents: null };
            const result = reducer(state, action);
            expect(result).toEqual({
                documents: [{ id: "foo" }]
            });
        });

        it("inserts document if documents not empty", () => {
            const state = {
                documents: [{ id: "bar" }]
            };
            const result = reducer(state, action);
            expect(result).toEqual({
                documents: [{ id: "bar" }, { id: "foo" }]
            });
        });
    });

    it("should handle WS_UPDATE_SUBTRACTION", () => {
        const state = {
            documents: [
                {
                    id: "foo",
                    ready: false
                }
            ]
        };
        const action = {
            type: WS_UPDATE_SUBTRACTION,
            data: {
                id: "foo",
                ready: true
            }
        };
        const result = reducer(state, action);
        expect(result).toEqual({ documents: [{ ...action.data }] });
    });

    it("should handle WS_REMOVE_SUBTRACTION", () => {
        const state = {
            documents: [
                {
                    id: "foo"
                }
            ]
        };
        const action = {
            type: WS_REMOVE_SUBTRACTION,
            data: ["foo"]
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            documents: []
        });
    });

    it("should handle FIND_SUBTRACTIONS_REQUESTED", () => {
        const action = {
            type: FIND_SUBTRACTIONS.REQUESTED,
            term: "foo",
            page: 5
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            term: action.term
        });
    });

    it("should handle FIND_SUBTRACTIONS_SUCCEEDED", () => {
        const action = {
            type: FIND_SUBTRACTIONS.SUCCEEDED,
            data: {
                documents: [],
                page: 1,
                page_count: 1
            }
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            documents: [],
            page: 1,
            page_count: 1
        });
    });

    it("should handle GET_SUBTRACTION_REQUESTED", () => {
        const action = {
            type: GET_SUBTRACTION.REQUESTED,
            subtractionId: "foo"
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            detail: null
        });
    });

    it("should handle GET_SUBTRACTION_SUCCEEDED", () => {
        const action = {
            type: GET_SUBTRACTION.SUCCEEDED,
            data: {
                id: "foo"
            }
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            detail: {
                id: "foo"
            }
        });
    });

    it("should handle UPDATE_SUBTRACTION_SUCCEEDED", () => {
        const action = {
            type: EDIT_SUBTRACTION.SUCCEEDED,
            data: { foo: "bar" }
        };
        const result = reducer({}, action);
        expect(result).toEqual({ detail: action.data });
    });
});

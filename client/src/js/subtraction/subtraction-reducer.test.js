import {
    WS_INSERT_SUBTRACTION,
    WS_UPDATE_SUBTRACTION,
    WS_REMOVE_SUBTRACTION,
    LIST_SUBTRACTIONS,
    GET_SUBTRACTION,
    UPDATE_SUBTRACTION,
    FILTER_SUBTRACTIONS
} from "../actionTypes";
import reducer, { initialState as reducerInitialState } from "./reducer";

describe("Subtraction Reducer", () => {
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

    describe("should handle WS_INSERT_SUBTRACTION", () => {
        it("returns state if documents not yet fetched", () => {
            state = { fetched: false };
            action = { type: WS_INSERT_SUBTRACTION };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("inserts entry into list otherwise", () => {
            state = {
                ...initialState,
                documents: [],
                page: 1,
                per_page: 25,
                fetched: true,
                total_count: 0
            };
            action = {
                type: WS_INSERT_SUBTRACTION,
                data: {
                    file: {
                        id: "abc123-file.171",
                        name: "file.171"
                    },
                    id: "testSubtraction",
                    job: { id: "jobId" },
                    ready: false
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                documents: [{ ...action.data }],
                total_count: 1
            };
            expect(result).toEqual(expected);
        });
    });

    it("should handle WS_UPDATE_SUBTRACTION", () => {
        state = {
            ...initialState,
            documents: [
                {
                    file: { id: "abc123-file.171", name: "file.171" },
                    id: "testSubtraction",
                    job: { id: "jobId" },
                    ready: false
                }
            ]
        };
        action = {
            type: WS_UPDATE_SUBTRACTION,
            data: {
                file: { id: "abc123-file.171", name: "file.171" },
                id: "testSubtraction",
                job: { id: "jobId" },
                ready: true
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: [{ ...action.data }]
        };
        expect(result).toEqual(expected);
    });

    it("should handle WS_REMOVE_SUBTRACTION", () => {
        state = {
            ...initialState,
            documents: [
                {
                    file: { id: "abc123-file.171", name: "file.171" },
                    id: "testSubtraction",
                    job: { id: "jobId" },
                    ready: true
                }
            ],
            total_count: 1
        };
        action = {
            type: WS_REMOVE_SUBTRACTION,
            data: ["testSubtraction"]
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: [],
            refetchPage: false,
            total_count: 0
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_SUBTRACTIONS_REQUESTED", () => {
        state = initialState;
        action = {
            type: LIST_SUBTRACTIONS.REQUESTED,
            page: 123
        };
        result = reducer(state, action);
        expected = {
            ...state,
            isLoading: true,
            errorLoad: false
        };

        expect(result).toEqual(expected);
    });

    it("should handle LIST_SUBTRACTIONS_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: LIST_SUBTRACTIONS.SUCCEEDED,
            data: {
                documents: [],
                found_count: 0,
                host_count: 0,
                page: 1,
                page_count: 1,
                per_page: 25,
                ready_host_count: 0,
                total_count: 0
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data,
            isLoading: false,
            errorLoad: false,
            fetched: true,
            refetchPage: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_SUBTRACTIONS_FAILED", () => {
        state = initialState;
        action = {
            type: LIST_SUBTRACTIONS.FAILED,
            message: "not found",
            status: 404
        };
        result = reducer(state, action);
        expected = {
            ...state,
            isLoading: false,
            errorLoad: true
        };
        expect(result).toEqual(expected);
    });

    it("should handle GET_SUBTRACTION_REQUESTED", () => {
        state = initialState;
        action = {
            type: GET_SUBTRACTION.REQUESTED,
            subtractionId: "testSubtraction"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null
        };
        expect(result).toEqual(expected);
    });

    it("should handle GET_SUBTRACTION_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: GET_SUBTRACTION.SUCCEEDED,
            data: {
                file: { id: "abc123-file.171", name: "file.171" },
                id: "testSubtraction",
                job: { id: "jobId" },
                ready: true,
                count: 7,
                gc: {
                    a: 0.3,
                    t: 0.3,
                    g: 0.2,
                    c: 0.2,
                    n: 0
                },
                is_host: true,
                linked_samples: [],
                nickname: "testNickname",
                user: { id: "testUser" }
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };
        expect(result).toEqual(expected);
    });

    it("should handle UPDATE_SUBTRACTION_SUCCEEDED", () => {
        state = { detail: null };
        action = {
            type: UPDATE_SUBTRACTION.SUCCEEDED,
            data: { foo: "bar" }
        };
        result = reducer(state, action);
        expected = { detail: action.data };
        expect(result).toEqual(expected);
    });

    it("should handle FILTER_SUBTRACTIONS_REQUESTED", () => {
        state = initialState;
        action = {
            type: FILTER_SUBTRACTIONS.REQUESTED,
            term: "test"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            filter: action.term
        };
        expect(result).toEqual(expected);
    });

    it("should handle FILTER_SUBTRACTIONS_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: FILTER_SUBTRACTIONS.SUCCEEDED,
            data: {
                documents: [],
                found_count: 0,
                host_count: 0,
                page: 1,
                page_count: 1,
                per_page: 25,
                ready_host_count: 0,
                total_count: 0
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data
        };
        expect(result).toEqual(expected);
    });
});

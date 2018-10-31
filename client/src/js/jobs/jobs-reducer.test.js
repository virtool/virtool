import {
  WS_INSERT_JOB,
  WS_UPDATE_JOB,
  WS_REMOVE_JOB,
  GET_JOB,
  GET_RESOURCES, FIND_JOBS
} from "../actionTypes";
import reducer, { initialState as reducerInitialState } from "./reducer";

describe("Job Reducer", () => {
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

    describe("should handle WS_INSERT_JOB", () => {
        it("when documents are not yet fetched, returns state", () => {
            state = { fetched: false };
            action = { type: WS_INSERT_JOB };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("otherwise insert entry into list", () => {
            state = {
                fetched: true,
                documents: null,
                page: 0,
                per_page: 3,
                total_count: 0
            };
            action = { type: WS_INSERT_JOB, data: { id: "test" } };
            result = reducer(state, action);
            expected = {
                ...state,
                documents: [{ id: "test" }],
                total_count: 1
            };
            expect(result).toEqual(expected);
        });
    });

    it("should handle WS_UPDATE_JOB", () => {
        state = {
            documents: [
                {
                    id: "foo",
                    task: "test_job"
                },
                {
                    id: "bar",
                    task: "running_job"
                }
            ]
        };
        action = {
            type: WS_UPDATE_JOB,
            data: {
                id: "bar",
                task: "finish_job"
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: [
                {
                    id: "foo",
                    task: "test_job"
                },
                {
                    id: "bar",
                    task: "finish_job"
                }
            ]
        };
        expect(result).toEqual(expected);
    });

    it("should handle WS_REMOVE_JOB", () => {
        state = {
            page: 1,
            page_count: 3,
            documents: [{ id: "test1" }, { id: "test2" }],
            total_count: 2
        };
        action = {
            type: WS_REMOVE_JOB,
            data: ["test2"]
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: [{ id: "test1" }],
            refetchPage: true,
            total_count: 1
        };
        expect(result).toEqual(expected);
    });

    it("should handle FIND_JOBS_REQUESTED", () => {
        state = {};
        action = { type: FIND_JOBS.REQUESTED, term: "foo" };
        result = reducer(state, action);
        expect(result).toEqual({ term: "foo" });
    });

    it("should handle FIND_JOBS_REQUESTED", () => {
        state = { documents: null, page: 0 };
        action = {
            type: FIND_JOBS.SUCCEEDED,
            data: { documents: [] }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: [],
            isLoading: false,
            errorLoad: false,
            fetched: true,
            refetchPage: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_JOBS_FAILED", () => {
        state = {};
        action = { type: LIST_JOBS.FAILED };
        result = reducer(state, action);
        expected = { isLoading: false, errorLoad: true };
        expect(result).toEqual(expected);
    });

    it("should handle FILTER_JOBS_REQUESTED", () => {
        state = {};
        action = { type: FILTER_JOBS.REQUESTED, term: "search" };
        result = reducer(state, action);
        expected = { ...state, filter: "search" };
        expect(result).toEqual(expected);
    });

    it("should handle FILTER_JOBS_SUCCEEDED", () => {
        state = { documents: null };
        action = {
            type: FILTER_JOBS.SUCCEEDED,
            data: { documents: [] }
        };
        result = reducer(state, action);
        expected = { ...state, documents: [] };
        expect(result).toEqual(expected);
    });

    it("should handle GET_JOB_REQUESTED", () => {
        state = { detail: { foo: "bar" } };
        action = { type: GET_JOB.REQUESTED };
        result = reducer(state, action);
        expected = { ...state, detail: null };
        expect(result).toEqual(expected);
    });

    it("should handle GET_JOB_SUCCEEDED", () => {
        state = {};
        action = {
            type: GET_JOB.SUCCEEDED,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_RESOURCES_SUCCEEDED", () => {
        state = {};
        action = {
            type: GET_RESOURCES.SUCCEEDED,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            resources: action.data
        };

        expect(result).toEqual(expected);
    });
});

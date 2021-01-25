import { WS_INSERT_JOB, WS_UPDATE_JOB, WS_REMOVE_JOB, GET_JOB, FIND_JOBS } from "../../app/actionTypes";
import reducer, { initialState as reducerInitialState } from "../reducer";

describe("Job Reducer", () => {
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

    describe("should handle WS_INSERT_JOB", () => {
        it("when documents are not yet fetched, returns state", () => {
            const document = { id: "foo" };
            const action = { type: WS_INSERT_JOB, data: document };
            const result = reducer({}, action);
            expect(result).toEqual({
                documents: [document]
            });
        });

        it("otherwise insert entry into list", () => {
            const state = {
                documents: null,
                page: 1
            };
            const action = { type: WS_INSERT_JOB, data: { id: "test" } };
            const result = reducer(state, action);
            expect(result).toEqual({
                ...state,
                documents: [{ id: "test" }]
            });
        });
    });

    it("should handle WS_UPDATE_JOB", () => {
        const state = {
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
        const action = {
            type: WS_UPDATE_JOB,
            data: {
                id: "bar",
                task: "finish_job"
            }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
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
        });
    });

    it("should handle WS_REMOVE_JOB", () => {
        const state = {
            documents: [{ id: "test1" }, { id: "test2" }]
        };
        const action = {
            type: WS_REMOVE_JOB,
            data: ["test2"]
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            documents: [{ id: "test1" }]
        });
    });

    it("should handle FIND_JOBS_REQUESTED", () => {
        const action = { type: FIND_JOBS.REQUESTED, term: "foo" };
        const result = reducer({}, action);
        expect(result).toEqual({ term: "foo" });
    });

    it("should handle FIND_JOBS_SUCCEEDED", () => {
        const state = { documents: null, page: 1 };
        const documents = [{ id: "foo" }];
        const action = {
            type: FIND_JOBS.SUCCEEDED,
            data: { documents, page: 2 }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            documents,
            page: 2
        });
    });

    it("should handle GET_JOB_REQUESTED", () => {
        const state = { detail: { foo: "bar" } };
        const action = { type: GET_JOB.REQUESTED };
        const result = reducer(state, action);
        expect(result).toEqual({
            detail: null
        });
    });

    it("should handle GET_JOB_SUCCEEDED", () => {
        const state = {};
        const action = {
            type: GET_JOB.SUCCEEDED,
            data: { id: "foo" }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            detail: action.data
        });
    });
});

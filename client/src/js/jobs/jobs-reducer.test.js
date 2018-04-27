import reducer, {
    initialState as reducerInitialState,
    updateJob
} from "./reducer";
import {
    WS_UPDATE_JOB,
    WS_REMOVE_JOB,
    FIND_JOBS,
    GET_JOB,
    CANCEL_JOB,
    GET_RESOURCES
} from "../actionTypes";

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

    describe("should handle WS_UPDATE_JOB", () => {

        it("when [documents=null], return state", () => {
            state = {
                documents: null
            };
            action = {
                type: "WS_UPDATE_JOB"
            };
            result = reducer(state, action);
            expected = state;
    
            expect(result).toEqual(expected);
        });

        it("otherwise update job", () => {
            state = {
                documents: [
                    {
                        id: "testid",
                        task: "test_job"
                    },
                    {
                        id: "anotherid",
                        task: "update_job"
                    }
                ]
            };
            action = {
                type: "WS_UPDATE_JOB",
                data: {
                    id: "anotherid",
                    update: "update"
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                documents: [
                    {
                        id: "testid",
                        task: "test_job"
                    },
                    {
                        id: "anotherid",
                        task: "update_job",
                        update: "update"
                    }
                ]
            };

            expect(result).toEqual(expected);
        });

    });

    it("should handle WS_REMOVE_JOB", () => {
        state = {
            documents: [
                {
                    id: "test1",
                },
                {
                    id: "test2",
                }
            ]
        };
        action = {
            type: "WS_REMOVE_JOB",
            jobId: "test2"
        };
        result = reducer(state, action);
        expected = {
            documents: [
                {
                    id: "test1",
                }
            ]
        };

        expect(result).toEqual(expected);
    });

    it("should handle FIND_JOBS_SUCCEEDED", () => {
        state = {};
        action = {
            type: "FIND_JOBS_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_JOB_REQUESTED", () => {
        state = {};
        action = {
            type: "GET_JOB_REQUESTED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_JOB_SUCCEEDED", () => {
        state = {};
        action = {
            type: "GET_JOB_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle CANCEL_JOB_SUCCEEDED", () => {
        state = {
            documents: [
                {
                    id: "testid",
                    task: "test_job"
                },
                {
                    id: "anotherid",
                    task: "update_job"
                }
            ]
        };
        action = {
            type: "CANCEL_JOB_SUCCEEDED",
            data: {
                id: "testid",
                update: "cancelled"
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: [
                {
                    id: "testid",
                    task: "test_job",
                    update: "cancelled"
                },
                {
                    id: "anotherid",
                    task: "update_job"
                }
            ]
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_RESOURCES_SUCCEEDED", () => {
        state = {};
        action = {
            type: "GET_RESOURCES_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            resources: action.data
        };

        expect(result).toEqual(expected);
    });

    describe("Job Reducer Helper Functions", () => {

        describe("updateJob", () => {

            it("updates a specific job", () => {
                state = {
                    documents: [
                        {
                            id: "test1",
                        },
                        {
                            id: "test2",
                        },
                        {
                            id: "test3"
                        }
                    ]
                };
                action = {
                    data: {
                        id: "test2",
                        update: "test_update"
                    }
                };
                result = updateJob(state, action);
                expected = {
                    ...state,
                    documents: [
                        {
                            id: "test1",
                        },
                        {
                            id: "test2",
                            update: "test_update"
                        },
                        {
                            id: "test3"
                        }
                    ]
                };

                expect(result).toEqual(expected);
            });

        });
    });

});

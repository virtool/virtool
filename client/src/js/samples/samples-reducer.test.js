import reducer, {
    initialState as reducerInitialState,
    setNuvsBLAST
} from "./reducer";
import {
    FIND_SAMPLES,
    GET_SAMPLE,
    UPDATE_SAMPLE,
    REMOVE_SAMPLE,
    SHOW_REMOVE_SAMPLE,
    HIDE_SAMPLE_MODAL,
    FIND_ANALYSES,
    FIND_READY_HOSTS,
    GET_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,
    REMOVE_ANALYSIS, GET_ANALYSIS_PROGRESS
} from "../actionTypes";

import { map } from "lodash-es";

describe("Samples Reducer", () => {

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

    it("should handle FIND_SAMPLES_SUCCEEDED", () => {
        state = {};
        action = {
            type: "FIND_SAMPLES_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle FIND_READY_HOSTS_SUCCEEDED", () => {
        state = {};
        action = {
            type: "FIND_READY_HOSTS_SUCCEEDED",
            data: {
                documents: []
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            readyHosts: action.data.documents
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_SAMPLE_REQUESTED", () => {
        state = {};
        action = {
            type: "GET_SAMPLE_REQUESTED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null,
            analyses: null,
            analysisDetail: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_SAMPLE_SUCCEEDED", () => {
        state = {};
        action = {
            type: "GET_SAMPLE_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };

        expect(result).toEqual(expected);
    });

    describe("should handle UPDATE_SAMPLE_SUCCEEDED", () => {

        it("when [state.documents=null], returns state", () => {
            state = {
                documents: null
            };
            action = {
                type: "UPDATE_SAMPLE_SUCCEEDED"
            };
            result = reducer(state, action);
            expected = state;
    
            expect(result).toEqual(expected);
        });

        it("otherwise updates target sample", () => {
            state = {
                documents: [
                    { id: "test1" },
                    { id: "test2" }
                ]
            };
            action = {
                type: "UPDATE_SAMPLE_SUCCEEDED",
                data: {
                    id: "test1",
                    update: "update_test"
                }
            };

            result = reducer(state, action);
            expected = {
                documents: [
                    { id: "test1", update: "update_test" },
                    { id: "test2" }
                ]
            };
    
            expect(result).toEqual(expected);
        });

    });

    it("should handle REMOVE_SAMPLE_SUCCEEDED", () => {
        state = {};
        action = {
            type: "REMOVE_SAMPLE_SUCCEEDED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null,
            analyses: null,
            analysisDetail: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle SHOW_REMOVE_SAMPLE", () => {
        state = {};
        action = {
            type: "SHOW_REMOVE_SAMPLE"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            showRemove: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle HIDE_SAMPLE_MODAL", () => {
        state = {};
        action = {
            type: "HIDE_SAMPLE_MODAL"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            showRemove: false
        };

        expect(result).toEqual(expected);
    });

    it("should handle FIND_ANALYSES_REQUESTED", () => {
        state = {};
        action = {
            type: "FIND_ANALYSES_REQUESTED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            analyses: null,
            analysisDetail: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle FIND_ANALYSES_SUCCEEDED", () => {
        state = {};
        action = {
            type: "FIND_ANALYSES_SUCCEEDED",
            data: {
                documents: []
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            analyses: action.data.documents
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_ANALYSIS_REQUESTED", () => {
        state = {};
        action = {
            type: "GET_ANALYSIS_REQUESTED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            analysisDetail: null,
            getAnalysisProgress: 0
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_ANALYSIS_SUCCEEDED", () => {
        state = {};
        action = {
            type: "GET_ANALYSIS_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            analysisDetail: action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_ANALYSIS_PROGRESS", () => {
        state = {};
        action = {
            type: "GET_ANALYSIS_PROGRESS",
            progress: 50
        };
        result = reducer(state, action);
        expected = {
            ...state,
            getAnalysisProgress: 50
        };

        expect(result).toEqual(expected);
    });

    describe("should handle ANALYZE_REQUESTED", () => {

        it("when [state.analyses=null], return state", () => {
            state = {
                analyses: null
            };
            action = {
                type: "ANALYZE_REQUESTED"
            };
            result = reducer(state, action);
            expected = state;

            expect(result).toEqual(expected);
        });

        it("otherwise append placeholder", () => {
            state = {
                analyses: []
            };
            action = {
                type: "ANALYZE_REQUESTED",
                placeholder: {}
            };
            result = reducer(state, action);
            expected = {
                ...state,
                analyses: [{}]
            };

            expect(result).toEqual(expected);
        });

    });

    describe("should handle ANALYZE_SUCCEEDED", () => {

        it("when [state.analyses=null], return state", () => {
            state = {
                analyses: null
            };
            action = {
                type: "ANALYZE_SUCCEEDED"
            };
            result = reducer(state, action);
            expected = state;

            expect(result).toEqual(expected);
        });

        it("otherwise replace placeholder with proper data", () => {
            state = {
                analyses: [
                    { id: "test_placeholder" },
                    { id: "random_string" }
                ]
            };
            action = {
                type: "ANALYZE_SUCCEEDED",
                placeholder: { id: "test_placeholder" },
                data: {
                    id: "test_replacement"
                }
            };
            result = reducer(state, action);
            expected = {
                analyses: [
                    { id: "test_replacement" },
                    { id: "random_string" }
                ]
            };

            expect(result).toEqual(expected);
        });

    });

    describe("should handle ANALYZE_FAILED", () => {
        
        it("when [state.analyses=null], return state", () => {
            state = {
                analyses: null
            };
            action = {
                type: "ANALYZE_FAILED"
            };
            result = reducer(state, action);
            expected = state;

            expect(result).toEqual(expected);
        });

        it("otherwise return state with placeholder removed", () => {
            state = {
                analyses: [
                    { id: "test_placeholder" },
                    { id: "random_string" }
                ]
            };
            action = {
                type: "ANALYZE_FAILED",
                placeholder: {
                    id: "test_placeholder"
                }
            };
            result = reducer(state, action);
            expected = {
                analyses: [
                    { id: "random_string" }
                ]
            };

            expect(result).toEqual(expected);
        });

    });

    it("should handle BLAST_NUVS_REQUESTED", () => {
        state = {
            analysisDetail: {
                id: "testid",
                algorithm: "nuvs",
                results: [
                    { index: 3 },
                    { index: 5 }
                ]
            }
        };
        action = {
            type: "BLAST_NUVS_REQUESTED",
            analysisId: "testid",
            sequenceIndex: 3
        };
        result = reducer(state, action);
        expected = {
            ...state,
            analysisDetail: {
                ...state.analysisDetail,
                results: [
                    { index: 3, blast: {ready: false} },
                    { index: 5 }
                ]
            }
        };

        expect(result).toEqual(expected);
    });

    it("should handle BLAST_NUVS_SUCCEEDED", () => {
        state = {
            analysisDetail: {
                id: "testid",
                algorithm: "nuvs",
                results: [
                    { index: 3 },
                    { index: 5 }
                ]
            }
        };
        action = {
            type: "BLAST_NUVS_SUCCEEDED",
            analysisId: "testid",
            sequenceIndex: 3,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            analysisDetail: {
                ...state.analysisDetail,
                results: [
                    { index: 3, blast: {} },
                    { index: 5 }
                ]
            }
        };

        expect(result).toEqual(expected);
    });

    describe("should handle REMOVE_ANALYSIS_SUCCEEDED", () => {

        it("when [state.analyses=null], return state", () => {
            state = {
                analyses: null
            };
            action = {
                type: "REMOVE_ANALYSIS_SUCCEEDED"
            };
            result = reducer(state, action);
            expected = state;

            expect(result).toEqual(expected);
        });

        it("otherwise remove target analysis by id", () => {
            state = {
                analyses: [
                    { id: "test_target" },
                    { id: "pathoscope_bowtie" }
                ]
            };
            action = {
                type: "REMOVE_ANALYSIS_SUCCEEDED",
                id: "test_target"
            };
            result = reducer(state, action);
            expected = {
                analyses: [
                    { id: "pathoscope_bowtie" }
                ]
            };

            expect(result).toEqual(expected);
        });

    });

    describe("Samples Reducer Helper Functions", () => {

        describe("setNuvsBLAST", () => {
            let analysisId;
            let sequenceIndex;
            let data;

            it("when id matches target id, update with blast data", () => {
                state = {
                    analysisDetail: {
                        id: "testid",
                        algorithm: "nuvs",
                        results: [
                            { index: 3 },
                            { index: 5 }
                        ]
                    }
                };
                analysisId = "testid";
                sequenceIndex = 3;
                data = { payload: "data_to_be_added" };
                result = setNuvsBLAST(state, analysisId, sequenceIndex, data);
                expected = {
                    ...state,
                    analysisDetail: {
                        ...state.analysisDetail,
                        results: [
                            { index: 3, blast: { payload: "data_to_be_added" } },
                            { index: 5 }
                        ]
                    }
                };
        
                expect(result).toEqual(expected);
            });

            it("otherwise return state", () => {
                state = {
                    analysisDetail: {
                        id: "testid",
                        algorithm: "nuvs",
                        results: [
                            { index: 3 },
                            { index: 5 }
                        ]
                    }
                };
                analysisId = "differentid";
                sequenceIndex = 3;
                result = setNuvsBLAST(state, analysisId, sequenceIndex);
                expected = state;
        
                expect(result).toEqual(expected);
            });

        });
    });
});

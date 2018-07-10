import reducer, {
    initialState as reducerInitialState,
    setNuvsBLAST
} from "./reducer";

describe("Analyses Reducer", () => {

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

    it("should handle FIND_ANALYSES_REQUESTED", () => {
        state = {};
        action = { type: "FIND_ANALYSES_REQUESTED", sampleId: "tester" };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null,
            documents: null
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
            documents: action.data.documents
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
            detail: null
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
            detail: action.data
        };

        expect(result).toEqual(expected);
    });

    describe("should handle ANALYZE_REQUESTED", () => {

        it("when [state.documents=null], return state", () => {
            state = {
                documents: null
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
                documents: []
            };
            action = {
                type: "ANALYZE_REQUESTED",
                placeholder: {}
            };
            result = reducer(state, action);
            expected = {
                ...state,
                documents: [{}]
            };

            expect(result).toEqual(expected);
        });

    });

    describe("should handle ANALYZE_SUCCEEDED", () => {

        it("when [state.documents=null], return state", () => {
            state = {
                documents: null
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
                documents: [
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
                documents: [
                    { id: "test_replacement" },
                    { id: "random_string" }
                ]
            };

            expect(result).toEqual(expected);
        });

    });

    describe("should handle ANALYZE_FAILED", () => {

        it("when [state.documents=null], return state", () => {
            state = {
                documents: null
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
                documents: [{ id: "test_placeholder" },{ id: "random_string" }]
            };
            action = {
                type: "ANALYZE_FAILED",
                placeholder: {
                    id: "test_placeholder"
                }
            };
            result = reducer(state, action);
            expected = {
                documents: [{ id: "random_string" }]
            };

            expect(result).toEqual(expected);
        });

    });

    it("should handle BLAST_NUVS_REQUESTED", () => {
        state = {
            detail: {
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
            detail: {
                ...state.detail,
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
            detail: {
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
            detail: {
                ...state.detail,
                results: [
                    { index: 3, blast: {} },
                    { index: 5 }
                ]
            }
        };

        expect(result).toEqual(expected);
    });

    describe("should handle REMOVE_ANALYSIS_SUCCEEDED", () => {

        it("when [state.documents=null], return state", () => {
            state = {
                documents: null
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
                documents: [
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
                documents: [{ id: "pathoscope_bowtie" }]
            };

            expect(result).toEqual(expected);
        });

    });

    describe("Analyses Reducer Helper Functions", () => {

        describe("setNuvsBLAST", () => {
            let analysisId;
            let sequenceIndex;
            let data;

            it("when id matches target id, update with blast data", () => {
                state = {
                    detail: {
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
                    detail: {
                        ...state.detail,
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
                    detail: {
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

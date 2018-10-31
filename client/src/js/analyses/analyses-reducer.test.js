import {
    WS_INSERT_ANALYSIS,
    WS_UPDATE_ANALYSIS,
    WS_REMOVE_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,
    CLEAR_ANALYSIS,
    COLLAPSE_ANALYSIS,
    FIND_ANALYSES,
    GET_ANALYSIS,
    LIST_READY_INDEXES,
    SET_PATHOSCOPE_SORT_KEY,
    TOGGLE_ANALYSIS_EXPANDED,
    TOGGLE_SORT_PATHOSCOPE_DESCENDING,
    TOGGLE_SHOW_PATHOSCOPE_MEDIAN,
    TOGGLE_SHOW_PATHOSCOPE_READS,
    SET_PATHOSCOPE_FILTER
} from "../actionTypes";
import reducer, {
    initialState as reducerInitialState,
    addDepth,
    collapse,
    toggleMedian,
    setFilter,
    setNuvsBLAST,
    toggleExpanded,
    insert
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
        action = { type: "UNHANDLED_ACTION" };
        result = reducer(initialState, action);
        expected = initialState;
        expect(result).toEqual(expected);
    });

    describe("should handle WS_INSERT_ANALYSIS", () => {
        it("return state if sample id does not match current sample", () => {
            state = { sampleId: "testSample" };
            action = {
                type: WS_INSERT_ANALYSIS,
                data: { sample: { id: "differentSample" } }
            };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("otherwise insert entry into current list", () => {
            state = {
                ...initialState,
                documents: null,
                sampleId: "testSample"
            };
            action = {
                type: WS_INSERT_ANALYSIS,
                data: {
                    sample: { id: "testSample" },
                    id: "123abc",
                    created_at: "2018-01-01T00:00:00.000000Z"
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                documents: [action.data]
            };
            expect(result).toEqual(expected);
        });
    });

    it("should handle WS_UPDATE_ANALYSIS", () => {
        state = {
            ...initialState,
            documents: [
                {
                    id: "123abc",
                    created_at: "2018-01-01T00:00:00.000000Z",
                    foo: "test"
                }
            ]
        };
        action = {
            type: WS_UPDATE_ANALYSIS,
            data: {
                id: "123abc",
                created_at: "2018-01-01T00:00:00.000000Z",
                foo: "bar"
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: [action.data]
        };
        expect(result).toEqual(expected);
    });

    it("should handle WS_REMOVE_ANALYSIS", () => {
        state = {
            ...initialState,
            documents: [{ id: "test" }]
        };
        action = {
            type: WS_REMOVE_ANALYSIS,
            data: ["test"]
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: []
        };
        expect(result).toEqual(expected);
    });

    it("should handle COLLAPSE_ANALYSIS", () => {
        state = {
            ...initialState,
            data: []
        };
        action = { type: COLLAPSE_ANALYSIS };
        result = reducer(state, action);
        expected = state;
        expect(result).toEqual(expected);
    });

    it("should handle SET_PATHOSCOPE_FILTER", () => {
        state = {
            ...initialState,
            filterIsolates: false,
            filterOTUs: false
        };
        action = { type: SET_PATHOSCOPE_FILTER, key: undefined };
        result = reducer(state, action);
        expected = {
            ...state,
            filterIsolates: true,
            filterOTUs: true
        };
        expect(result).toEqual(expected);
    });

    it("should handle TOGGLE_SHOW_PATHOSCOPE_MEDIAN", () => {
        state = initialState;
        action = { type: TOGGLE_SHOW_PATHOSCOPE_MEDIAN };
        result = reducer(state, action);
        expected = {
            ...state,
            data: [],
            showMedian: !state.showMedian
        };
        expect(result).toEqual(expected);
    });

    it("should handle TOGGLE_SHOW_PATHOSCOPE_READS", () => {
        state = initialState;
        action = { type: TOGGLE_SHOW_PATHOSCOPE_READS };
        result = reducer(state, action);
        expected = {
            ...state,
            showReads: !state.showReads
        };
        expect(result).toEqual(expected);
    });

    it("should handle TOGGLE_SORT_PATHOSCOPE_DESCENDING", () => {
        state = initialState;
        action = { type: TOGGLE_SORT_PATHOSCOPE_DESCENDING };
        result = reducer(state, action);
        expected = {
            ...state,
            sortDescending: !state.sortDescending
        };
        expect(result).toEqual(expected);
    });

    it("should handle SET_PATHOSCOPE_SORT_KEY", () => {
        state = initialState;
        action = { type: SET_PATHOSCOPE_SORT_KEY, key: "test" };
        result = reducer(state, action);
        expected = { ...state, sortKey: action.key };
        expect(result).toEqual(expected);
    });

    it("should handle TOGGLE_ANALYSIS_EXPANDED", () => {
        state = { ...initialState, data: [] };
        action = { type: TOGGLE_ANALYSIS_EXPANDED, id: "test" };
        result = reducer(state, action);
        expected = { ...state, data: [] };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_READY_INDEXES_SUCCEEDED", () => {
        state = initialState;
        action = { type: LIST_READY_INDEXES.SUCCEEDED, data: [] };
        result = reducer(state, action);
        expected = { ...state, readyIndexes: [] };
        expect(result).toEqual(expected);
    });

    it("should handle FIND_ANALYSES_REQUESTED", () => {
        state = {};
        action = { type: FIND_ANALYSES.REQUESTED, sampleId: "tester" };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null,
            documents: null,
            sampleId: "tester"
        };
        expect(result).toEqual(expected);
    });

    it("should handle FIND_ANALYSES_SUCCEEDED", () => {
        state = {};
        action = {
            type: FIND_ANALYSES.SUCCEEDED,
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

    it("should handle FILTER_ANALYSES_REQUESTED", () => {
        state = { filter: "" };
        action = { type: FILTER_ANALYSES.REQUESTED, term: "search" };
        result = reducer(state, action);
        expected = { ...state, filter: "search" };
        expect(result).toEqual(expected);
    });

    it("should handle FILTER_ANALYSES_SUCCEEDED", () => {
        state = { documents: null };
        action = {
            type: FILTER_ANALYSES.SUCCEEDED,
            data: { documents: [] }
        };
        result = reducer(state, action);
        expected = { ...state, documents: [] };
        expect(result).toEqual(expected);
    });

    it("should handle GET_ANALYSIS_REQUESTED", () => {
        state = {};
        action = {
            type: GET_ANALYSIS.REQUESTED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null,
            data: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_ANALYSIS_SUCCEEDED for nuvs", () => {
        state = {};
        action = {
            type: "GET_ANALYSIS_SUCCEEDED",
            algorithm: "nuvs",
            data: {
                diagnosis: []
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data,
            data: action.data
        };

        expect(result).toEqual(expected);
    });

    describe("should handle GET_ANALYSIS_SUCCEEDED for pathoscope", () => {
        it("adds formatted data for ready pathoscope analyses", () => {
            state = {};
            action = {
                type: "GET_ANALYSIS_SUCCEEDED",
                data: {
                    algorithm: "pathoscope_bowtie",
                    diagnosis: [],
                    ready: true
                }
            };
            result = reducer(state, action);
            expected = {
                detail: action.data,
                data: []
            };
            expect(result).toEqual(expected);
        });

        it("otherwise adds unformatted data", () => {
            state = {};
            action = {
                type: "GET_ANALYSIS_SUCCEEDED",
                data: {
                    algorithm: "pathoscope_bowtie",
                    diagnosis: [],
                    ready: false
                }
            };
            result = reducer(state, action);
            expected = {
                detail: action.data,
                data: action.data
            };
            expect(result).toEqual(expected);
        });
    });

    it("should handle CLEAR_ANALYSIS", () => {
        state = { data: [], detail: {} };
        action = { type: CLEAR_ANALYSIS };
        result = reducer(state, action);
        expected = { data: null, detail: null };
        expect(result).toEqual(expected);
    });

    describe("should handle ANALYZE_REQUESTED", () => {
        it("when [state.documents=null], return state", () => {
            state = {
                documents: null
            };
            action = {
                type: ANALYZE.REQUESTED
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
                type: ANALYZE.REQUESTED,
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

    it("should handle BLAST_NUVS_REQUESTED", () => {
        state = {
            detail: {
                id: "testid",
                algorithm: "nuvs",
                results: [{ index: 3 }, { index: 5 }]
            }
        };
        action = {
            type: BLAST_NUVS.REQUESTED,
            analysisId: "testid",
            sequenceIndex: 3
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: {
                ...state.detail,
                results: [{ index: 3, blast: { ready: false } }, { index: 5 }]
            }
        };

        expect(result).toEqual(expected);
    });

    it("should handle BLAST_NUVS_SUCCEEDED", () => {
        state = {
            detail: {
                id: "testid",
                algorithm: "nuvs",
                results: [{ index: 3 }, { index: 5 }]
            }
        };
        action = {
            type: BLAST_NUVS.SUCCEEDED,
            analysisId: "testid",
            sequenceIndex: 3,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: {
                ...state.detail,
                results: [{ index: 3, blast: {} }, { index: 5 }]
            }
        };

        expect(result).toEqual(expected);
    });

    describe("Analyses Reducer Helper Functions", () => {
        describe("addDepth", () => {
            const data = [
                {
                    id: "test1",
                    medianDepth: 1,
                    meanDepth: 2,
                    isolates: [{ id: "a", medianDepth: 3, meanDepth: 4 }]
                },
                {
                    id: "test2",
                    medianDepth: 1,
                    meanDepth: 2,
                    isolates: [{ id: "b", medianDepth: 3, meanDepth: 4 }]
                },
                {
                    id: "test3",
                    medianDepth: 1,
                    meanDepth: 2,
                    isolates: [{ id: "c", medianDepth: 3, meanDepth: 4 }]
                }
            ];
            let showMedian;

            it("when [showMedian=true], depth = medianDepth", () => {
                showMedian = true;
                result = addDepth(data, showMedian);
                expected = [
                    {
                        id: "test1",
                        depth: 1,
                        medianDepth: 1,
                        meanDepth: 2,
                        isolates: [
                            {
                                id: "a",
                                depth: 3,
                                medianDepth: 3,
                                meanDepth: 4
                            }
                        ]
                    },
                    {
                        id: "test2",
                        depth: 1,
                        medianDepth: 1,
                        meanDepth: 2,
                        isolates: [
                            {
                                id: "b",
                                depth: 3,
                                medianDepth: 3,
                                meanDepth: 4
                            }
                        ]
                    },
                    {
                        id: "test3",
                        depth: 1,
                        medianDepth: 1,
                        meanDepth: 2,
                        isolates: [
                            {
                                id: "c",
                                depth: 3,
                                medianDepth: 3,
                                meanDepth: 4
                            }
                        ]
                    }
                ];
                expect(result).toEqual(expected);
            });

            it("otherwise, depth = meanDepth", () => {
                showMedian = false;
                result = addDepth(data, showMedian);
                expected = [
                    {
                        id: "test1",
                        depth: 2,
                        medianDepth: 1,
                        meanDepth: 2,
                        isolates: [
                            {
                                id: "a",
                                depth: 4,
                                medianDepth: 3,
                                meanDepth: 4
                            }
                        ]
                    },
                    {
                        id: "test2",
                        depth: 2,
                        medianDepth: 1,
                        meanDepth: 2,
                        isolates: [
                            {
                                id: "b",
                                depth: 4,
                                medianDepth: 3,
                                meanDepth: 4
                            }
                        ]
                    },
                    {
                        id: "test3",
                        depth: 2,
                        medianDepth: 1,
                        meanDepth: 2,
                        isolates: [
                            {
                                id: "c",
                                depth: 4,
                                medianDepth: 3,
                                meanDepth: 4
                            }
                        ]
                    }
                ];
                expect(result).toEqual(expected);
            });
        });

        describe("collapse", () => {
            const state = {
                data: [
                    { id: "test1", expanded: true },
                    { id: "test2", expanded: false },
                    { id: "test3", expanded: true }
                ]
            };

            it("should set all entries 'expanded' to false", () => {
                result = collapse(state);
                expected = [
                    { id: "test1", expanded: false },
                    { id: "test2", expanded: false },
                    { id: "test3", expanded: false }
                ];
                expect(result).toEqual(expected);
            });
        });

        describe("toggleMedian", () => {
            const state = {};

            it("toggles showMedian value in state", () => {
                state.showMedian = true;
                state.data = [];
                result = toggleMedian(state);
                expected = {
                    data: [],
                    showMedian: false
                };
                expect(result).toEqual(expected);
            });
        });

        describe("setFilter", () => {
            const state = {
                filterIsolates: false,
                filterOTUs: false
            };

            it("toggles filterIsolates when [key='isolates']", () => {
                result = setFilter(state, "isolates");
                expected = {
                    filterIsolates: true,
                    filterOTUs: false
                };
                expect(result).toEqual(expected);
            });

            it("toggles filterOTUs when [key='OTUs']", () => {
                result = setFilter(state, "OTUs");
                expected = {
                    filterIsolates: false,
                    filterOTUs: true
                };
                expect(result).toEqual(expected);
            });

            it("toggles both to true when no key is specified and both are false", () => {
                result = setFilter(state, undefined);
                expected = {
                    filterIsolates: true,
                    filterOTUs: true
                };
                expect(result).toEqual(expected);
            });

            it("toggles both to false when no key is specified and either/both are true", () => {
                state.filterIsolates = true;
                result = setFilter(state, undefined);
                expected = {
                    filterIsolates: false,
                    filterOTUs: false
                };
                expect(result).toEqual(expected);
            });
        });

        describe("toggleExpanded", () => {
            const state = {
                data: [
                    { id: "test1", expanded: true },
                    { id: "test2", expanded: false },
                    { id: "test3", expanded: true }
                ]
            };

            it("should toggle specific entry's 'expanded' value", () => {
                const id = "test1";
                result = toggleExpanded(state, id);
                expected = [
                    { id: "test1", expanded: false },
                    { id: "test2", expanded: false },
                    { id: "test3", expanded: true }
                ];
                expect(result).toEqual(expected);
            });
        });

        describe("setNuvsBLAST", () => {
            let analysisId;
            let sequenceIndex;
            let data;

            it("when id matches target id, update with blast data", () => {
                state = {
                    detail: {
                        id: "testid",
                        algorithm: "nuvs",
                        results: [{ index: 3 }, { index: 5 }]
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
                        results: [{ index: 3, blast: { payload: "data_to_be_added" } }, { index: 5 }]
                    }
                };

                expect(result).toEqual(expected);
            });

            it("otherwise return state", () => {
                state = {
                    detail: {
                        id: "testid",
                        algorithm: "nuvs",
                        results: [{ index: 3 }, { index: 5 }]
                    }
                };
                analysisId = "differentid";
                sequenceIndex = 3;
                result = setNuvsBLAST(state, analysisId, sequenceIndex);
                expected = state;

                expect(result).toEqual(expected);
            });
        });

        describe("insert", () => {
            let documents;
            const action = {
                type: "INSERT_ENTRY",
                data: {
                    user: { id: "foo" },
                    created_at: "2018-01-01T00:00:00.000000Z"
                }
            };
            const sampleId = "testSample";

            it("insert new entry on empty list", () => {
                documents = null;
                result = insert(documents, action, sampleId);
                expected = [{ ...action.data }];
                expect(result).toEqual(expected);
            });

            it("replace placeholder with new entry", () => {
                documents = [
                    {
                        user: { id: "foo" },
                        created_at: "2018-02-01T00:00:00.000000Z"
                    },
                    {
                        userId: "bar",
                        placeholder: true,
                        created_at: "2018-03-02T00:00:00.000000Z",
                        sampleId: "testSample"
                    },
                    {
                        user: { id: "foo" },
                        created_at: "2018-04-01T00:00:00.000000Z"
                    },
                    {
                        userId: "foo",
                        placeholder: true,
                        created_at: "2018-05-04T00:00:00.000000Z",
                        sampleId: "testSample"
                    }
                ];
                result = insert(documents, action, sampleId);
                expected = [
                    {
                        user: { id: "foo" },
                        created_at: "2018-01-01T00:00:00.000000Z"
                    },
                    {
                        user: { id: "foo" },
                        created_at: "2018-02-01T00:00:00.000000Z"
                    },
                    {
                        userId: "bar",
                        placeholder: true,
                        created_at: "2018-03-02T00:00:00.000000Z",
                        sampleId: "testSample"
                    },
                    {
                        user: { id: "foo" },
                        created_at: "2018-04-01T00:00:00.000000Z"
                    }
                ];
                expect(result).toEqual(expected);
            });
        });
    });
});

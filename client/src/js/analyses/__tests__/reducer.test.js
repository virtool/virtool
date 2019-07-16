jest.mock("../utils");

import {
    WS_INSERT_ANALYSIS,
    WS_UPDATE_ANALYSIS,
    WS_REMOVE_ANALYSIS,
    BLAST_NUVS,
    CLEAR_ANALYSIS,
    FIND_ANALYSES,
    GET_ANALYSIS,
    LIST_READY_INDEXES,
    TOGGLE_ANALYSIS_EXPANDED,
    TOGGLE_SORT_PATHOSCOPE_DESCENDING,
    TOGGLE_SHOW_PATHOSCOPE_READS,
    SET_PATHOSCOPE_FILTER,
    SET_ANALYSIS_SORT_KEY
} from "../../app/actionTypes";
import reducer, { initialState as reducerInitialState, setFilter, setNuvsBLAST } from "../reducer";
import { formatData } from "../utils";

formatData.mockImplementation(({ algorithm, ready }) => ({
    algorithm,
    ready,
    foo: "bar"
}));

describe("Analyses Reducer", () => {
    const initialState = reducerInitialState;

    it("should return the initial state", () => {
        const result = reducer(undefined, {});
        expect(result).toEqual(initialState);
    });

    it("should return the existing state for unhandled action types", () => {
        const action = { type: "UNHANDLED_ACTION" };
        const result = reducer(initialState, action);
        expect(result).toEqual(initialState);
    });

    it("should handle WS_INSERT_ANALYSIS", () => {
        const state = {
            ...initialState,
            documents: null,
            sampleId: "foo"
        };
        const action = {
            type: WS_INSERT_ANALYSIS,
            data: {
                id: "foo",
                created_at: "2018-01-01T00:00:00.000000Z"
            }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            documents: [action.data]
        });
    });

    it("should handle WS_UPDATE_ANALYSIS", () => {
        const state = {
            ...initialState,
            sampleId: "baz",
            documents: [{ id: "foo", created_at: "2018-01-01T00:00:00.000000Z", sample: { id: "baz" } }]
        };

        const action = {
            type: WS_UPDATE_ANALYSIS,
            data: {
                id: "foo",
                created_at: "2018-01-01T00:00:00.000000Z",
                sample: {
                    id: "baz"
                }
            }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            documents: [action.data]
        });
    });

    it("should handle WS_REMOVE_ANALYSIS", () => {
        const state = {
            ...initialState,
            documents: [{ id: "foo" }]
        };
        const action = {
            type: WS_REMOVE_ANALYSIS,
            data: ["foo"]
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            documents: []
        });
    });

    it("should handle SET_PATHOSCOPE_FILTER", () => {
        const state = {
            ...initialState,
            filterIsolates: false,
            filterOTUs: false
        };
        const action = { type: SET_PATHOSCOPE_FILTER, key: undefined };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            filterIsolates: true,
            filterOTUs: true
        });
    });

    it("should handle TOGGLE_SHOW_PATHOSCOPE_READS", () => {
        const state = initialState;
        const action = { type: TOGGLE_SHOW_PATHOSCOPE_READS };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            showReads: !state.showReads
        });
    });

    it("should handle TOGGLE_SORT_PATHOSCOPE_DESCENDING", () => {
        const state = initialState;
        const action = { type: TOGGLE_SORT_PATHOSCOPE_DESCENDING };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            sortDescending: !state.sortDescending
        });
    });

    it("should handle SET_ANALYSIS_SORT_KEY", () => {
        const state = {};
        const action = { type: SET_ANALYSIS_SORT_KEY, sortKey: "foo" };
        const result = reducer(state, action);
        expect(result).toEqual({ sortKey: action.sortKey });
    });

    it("should handle TOGGLE_ANALYSIS_EXPANDED", () => {
        const state = { ...initialState, data: [] };
        const action = { type: TOGGLE_ANALYSIS_EXPANDED, id: "test" };
        const result = reducer(state, action);
        expect(result).toEqual({ ...state, data: [] });
    });

    it("should handle LIST_READY_INDEXES_SUCCEEDED", () => {
        const state = initialState;
        const action = { type: LIST_READY_INDEXES.SUCCEEDED, data: [] };
        const result = reducer(state, action);
        expect(result).toEqual({ ...state, readyIndexes: [] });
    });

    it("should handle FIND_ANALYSES_REQUESTED", () => {
        const state = { term: "" };
        const action = { type: FIND_ANALYSES.REQUESTED, term: "foo" };
        const result = reducer(state, action);
        expect(result).toEqual({ ...state, term: "foo" });
    });

    it("should handle FIND_ANALYSES_SUCCEEDED", () => {
        const initialState = { documents: null };
        const action = {
            type: FIND_ANALYSES.SUCCEEDED,
            data: { documents: [] }
        };
        const result = reducer(initialState, action);
        expect(result).toEqual({ ...initialState, documents: [] });
    });

    it("should handle GET_ANALYSIS_REQUESTED", () => {
        const action = {
            type: GET_ANALYSIS.REQUESTED
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            activeId: null,
            detail: null,
            data: null
        });
    });

    it("should handle GET_ANALYSIS_SUCCEEDED for nuvs when ready", () => {
        const algorithm = "nuvs";
        const ready = true;
        const state = {
            activeId: null,
            data: null,
            detail: null,
            expanded: [],
            searchIds: ["bar", "baz"],
            sortKey: "depth"
        };
        const action = {
            type: "GET_ANALYSIS_SUCCEEDED",
            data: {
                algorithm,
                ready,
                diagnosis: []
            }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            activeId: null,
            data: null,
            detail: {
                algorithm,
                ready,
                foo: "bar"
            },
            expanded: [],
            searchIds: null,
            sortKey: "length"
        });
    });

    it("should handle GET_ANALYSIS_SUCCEEDED for nuvs when not ready", () => {
        const algorithm = "nuvs";
        const ready = false;
        const state = {};
        const action = {
            type: "GET_ANALYSIS_SUCCEEDED",
            data: {
                algorithm,
                ready,
                diagnosis: []
            }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            activeId: null,
            detail: {
                algorithm,
                ready,
                foo: "bar"
            },
            expanded: [],
            searchIds: null,
            sortKey: "length"
        });
    });

    it("should handle GET_ANALYSIS_SUCCEEDED for pathoscope when ready", () => {
        const algorithm = "pathoscope_bowtie";
        const ready = true;
        const state = {};
        const action = {
            type: "GET_ANALYSIS_SUCCEEDED",
            data: {
                algorithm,
                ready,
                diagnosis: []
            }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            activeId: null,
            detail: {
                algorithm,
                ready,
                foo: "bar"
            },
            expanded: [],
            searchIds: null,
            sortKey: "length"
        });
    });

    it("should handle GET_ANALYSIS_SUCCEEDED for pathoscope when not ready", () => {
        const algorithm = "pathoscope_bowtie";
        const ready = false;
        const state = {};
        const action = {
            type: "GET_ANALYSIS_SUCCEEDED",
            data: {
                algorithm,
                ready,
                diagnosis: []
            }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            activeId: null,
            detail: {
                algorithm,
                ready,
                foo: "bar"
            },
            expanded: [],
            searchIds: null,
            sortKey: "length"
        });
    });

    it("should handle CLEAR_ANALYSIS", () => {
        const state = { data: [], detail: {}, searchIds: ["foo"] };
        const action = { type: CLEAR_ANALYSIS };
        const result = reducer(state, action);
        expect(result).toEqual({ data: null, detail: null, searchIds: null });
    });

    it("should handle BLAST_NUVS_REQUESTED", () => {
        const state = {
            detail: {
                id: "testid",
                algorithm: "nuvs",
                results: [{ index: 3 }, { index: 5 }]
            }
        };
        const action = {
            type: BLAST_NUVS.REQUESTED,
            analysisId: "testid",
            sequenceIndex: 3
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            detail: {
                ...state.detail,
                results: [{ index: 3, blast: { ready: false } }, { index: 5 }]
            }
        });
    });

    it("should handle BLAST_NUVS_SUCCEEDED", () => {
        const state = {
            detail: {
                id: "testid",
                algorithm: "nuvs",
                results: [{ index: 3 }, { index: 5 }]
            }
        };
        const action = {
            type: BLAST_NUVS.SUCCEEDED,
            analysisId: "testid",
            sequenceIndex: 3,
            data: {}
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            detail: {
                ...state.detail,
                results: [{ index: 3, blast: {} }, { index: 5 }]
            }
        });
    });

    describe("Analyses Reducer Helper Functions", () => {
        describe("setFilter", () => {
            const state = {
                filterIsolates: false,
                filterOTUs: false
            };

            it("toggles filterIsolates when [key='isolates']", () => {
                const result = setFilter(state, "isolates");
                expect(result).toEqual({
                    filterIsolates: true,
                    filterOTUs: false
                });
            });

            it("toggles filterOTUs when [key='OTUs']", () => {
                const result = setFilter(state, "OTUs");
                expect(result).toEqual({
                    filterIsolates: false,
                    filterOTUs: true
                });
            });

            it("toggles both to true when no key is specified and both are false", () => {
                const result = setFilter(state, undefined);
                expect(result).toEqual({
                    filterIsolates: true,
                    filterOTUs: true
                });
            });

            it("toggles both to false when no key is specified and either/both are true", () => {
                const state = {
                    filterIsolates: true
                };
                const result = setFilter(state, undefined);
                expect(result).toEqual({
                    filterIsolates: false,
                    filterOTUs: false
                });
            });
        });

        describe("setNuvsBLAST", () => {
            it("when id matches target id, update with blast data", () => {
                const state = {
                    detail: {
                        id: "foo",
                        algorithm: "nuvs",
                        results: [{ index: 3 }, { index: 5 }]
                    }
                };
                const analysisId = "foo";
                const sequenceIndex = 3;
                const data = { payload: "data_to_be_added" };
                const result = setNuvsBLAST(state, analysisId, sequenceIndex, data);
                expect(result).toEqual({
                    ...state,
                    detail: {
                        ...state.detail,
                        results: [{ index: 3, blast: { payload: "data_to_be_added" } }, { index: 5 }]
                    }
                });
            });

            it("otherwise return state", () => {
                const state = {
                    detail: {
                        id: "foo",
                        algorithm: "nuvs",
                        results: [{ index: 3 }, { index: 5 }]
                    }
                };
                const analysisId = "bar";
                const sequenceIndex = 3;
                const result = setNuvsBLAST(state, analysisId, sequenceIndex);
                expect(result).toEqual(state);
            });
        });
    });
});

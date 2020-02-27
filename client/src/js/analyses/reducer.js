import { get, map } from "lodash-es";
import {
    BLAST_NUVS,
    CLEAR_ANALYSES,
    CLEAR_ANALYSIS,
    FIND_ANALYSES,
    GET_ANALYSIS,
    LIST_READY_INDEXES,
    SET_ANALYSIS_ACTIVE_ID,
    SET_ANALYSIS_SORT_KEY,
    SET_SEARCH_IDS,
    TOGGLE_ANALYSIS_SORT_DESCENDING,
    TOGGLE_FILTER_ISOLATES,
    TOGGLE_FILTER_ORFS,
    TOGGLE_FILTER_OTUS,
    TOGGLE_FILTER_SEQUENCES,
    WS_INSERT_ANALYSIS,
    WS_REMOVE_ANALYSIS,
    WS_UPDATE_ANALYSIS
} from "../app/actionTypes";
import { insert, remove, update, updateDocuments } from "../utils/reducers";
import { formatData } from "./utils";

export const initialState = {
    activeId: null,
    documents: null,
    term: "",
    data: null,
    detail: null,
    readyIndexes: null,

    sortKey: "coverage",
    sortDescending: true,

    searchIds: null,
    sortIds: null,

    // Pathoscope-specific
    filterOTUs: true,
    filterIsolates: true,

    // NuVs specific,
    filterORFs: true,
    filterSequences: true
};

export const setNuvsBLAST = (state, analysisId, sequenceIndex, data = "ip") => {
    const detail = state.detail;

    if (detail && detail.id === analysisId) {
        return {
            ...state,
            detail: {
                ...detail,
                results: map(detail.results, sequence => {
                    if (sequence.index === sequenceIndex) {
                        return { ...sequence, blast: data };
                    }

                    return sequence;
                })
            }
        };
    }

    return state;
};

export const updateIdLists = (state, action) => {
    const analysisDetailId = get(state, "detail.id", null);

    const detail = formatData(action.data);

    if (analysisDetailId === action.data.id) {
        return {
            ...state,
            detail
        };
    }

    return {
        ...state,
        activeId: null,
        filterIds: null,
        searchIds: null,
        detail,
        sortKey: action.data.algorithm === "nuvs" ? "length" : "coverage"
    };
};

export default function analysesReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_ANALYSIS:
            return insert(state, action, state.sortKey, state.sortDescending);

        case WS_UPDATE_ANALYSIS:
            return update(state, action);

        case WS_REMOVE_ANALYSIS:
            return remove(state, action);

        case SET_ANALYSIS_ACTIVE_ID:
            return { ...state, activeId: action.id };

        case SET_SEARCH_IDS:
            return { ...state, searchIds: action.ids };

        case TOGGLE_FILTER_OTUS:
            return { ...state, filterOTUs: !state.filterOTUs };

        case TOGGLE_FILTER_ISOLATES:
            return { ...state, filterIsolates: !state.filterIsolates };

        case TOGGLE_FILTER_ORFS:
            return { ...state, filterORFs: !state.filterORFs };

        case TOGGLE_FILTER_SEQUENCES: {
            return { ...state, filterSequences: !state.filterSequences };
        }

        case SET_ANALYSIS_SORT_KEY:
            return { ...state, sortKey: action.sortKey };

        case TOGGLE_ANALYSIS_SORT_DESCENDING:
            return { ...state, sortDescending: !state.sortDescending };

        case LIST_READY_INDEXES.SUCCEEDED:
            return { ...state, readyIndexes: action.data };

        case FIND_ANALYSES.REQUESTED:
            return { ...state, term: action.term };

        case FIND_ANALYSES.SUCCEEDED:
            return updateDocuments(state, action, "created_at", true);

        case GET_ANALYSIS.REQUESTED:
            if (get(state, "detail.id", null) !== action.analysisId) {
                return {
                    ...state,
                    activeId: null,
                    detail: null,
                    filterIds: null,
                    searchIds: null,
                    sortKey: "length"
                };
            }

            return state;

        case GET_ANALYSIS.SUCCEEDED: {
            return updateIdLists(state, action);
        }

        case CLEAR_ANALYSES:
            return {
                ...state,
                documents: null
            };

        case CLEAR_ANALYSIS:
            return {
                ...state,
                detail: null,
                searchIds: null
            };

        case BLAST_NUVS.REQUESTED:
            return setNuvsBLAST(state, action.analysisId, action.sequenceIndex, {
                ready: false
            });

        case BLAST_NUVS.SUCCEEDED:
            return setNuvsBLAST(state, action.analysisId, action.sequenceIndex, action.data);

        default:
            return state;
    }
}

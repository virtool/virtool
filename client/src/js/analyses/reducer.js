import { map } from "lodash-es";
import {
    WS_INSERT_ANALYSIS,
    WS_UPDATE_ANALYSIS,
    WS_REMOVE_ANALYSIS,
    BLAST_NUVS,
    CLEAR_ANALYSIS,
    COLLAPSE_ANALYSIS,
    FIND_ANALYSES,
    GET_ANALYSIS,
    LIST_READY_INDEXES,
    TOGGLE_ANALYSIS_EXPANDED,
    TOGGLE_SORT_PATHOSCOPE_DESCENDING,
    TOGGLE_SHOW_PATHOSCOPE_READS,
    SET_PATHOSCOPE_FILTER,
    SET_ACTIVE_HIT_ID,
    TOGGLE_FILTER_ORFS,
    TOGGLE_FILTER_SEQUENCES,
    SET_SEARCH_IDS,
    SET_ANALYSIS_SORT_KEY
} from "../app/actionTypes";
import { insert, update, remove, updateDocuments } from "../utils/reducers";
import { formatData } from "./utils";

export const initialState = {
    documents: null,
    term: "",
    data: null,
    detail: null,
    readyIndexes: null,
    sortKey: "coverage",
    sortDescending: true,

    // Pathoscope-specific
    filterOTUs: true,
    filterIsolates: true,
    showReads: false,

    // NuVs specific,
    filterORFs: true,
    filterSequences: true,
    searchIds: null
};

export const collapse = state =>
    map(state.data, item => ({
        ...item,
        expanded: false
    }));

export const setFilter = (state, key) => {
    if (key) {
        return {
            ...state,
            filterIsolates: key === "isolates" ? !state.filterIsolates : state.filterIsolates,
            filterOTUs: key === "OTUs" ? !state.filterOTUs : state.filterOTUs
        };
    }

    return {
        ...state,
        filterIsolates: !(state.filterIsolates || state.filterOTUs),
        filterOTUs: !(state.filterIsolates || state.filterOTUs)
    };
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

export const toggleExpanded = (state, id) =>
    map(state.data, item => {
        if (item.id === id) {
            return { ...item, expanded: !item.expanded };
        }

        return item;
    });

export default function analysesReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_ANALYSIS:
            return insert(state, action, state.sortKey, state.sortDescending);

        case WS_UPDATE_ANALYSIS:
            return update(state, action);

        case WS_REMOVE_ANALYSIS:
            return remove(state, action);

        case COLLAPSE_ANALYSIS:
            return { ...state, data: collapse(state) };

        case SET_ACTIVE_HIT_ID:
            return { ...state, activeId: action.id };

        case SET_ANALYSIS_SORT_KEY:
            return { ...state, sortKey: action.sortKey };

        case SET_PATHOSCOPE_FILTER:
            return setFilter(state, action.key);

        case SET_SEARCH_IDS:
            return { ...state, searchIds: action.ids };

        case TOGGLE_FILTER_ORFS:
            return { ...state, filterORFs: !state.filterORFs };

        case TOGGLE_FILTER_SEQUENCES: {
            return { ...state, filterSequences: !state.filterSequences };
        }

        case TOGGLE_SHOW_PATHOSCOPE_READS:
            return { ...state, showReads: !state.showReads };

        case TOGGLE_SORT_PATHOSCOPE_DESCENDING:
            return { ...state, sortDescending: !state.sortDescending };

        case TOGGLE_ANALYSIS_EXPANDED:
            return { ...state, data: toggleExpanded(state, action.id) };

        case LIST_READY_INDEXES.SUCCEEDED:
            return { ...state, readyIndexes: action.data };

        case FIND_ANALYSES.REQUESTED:
            return { ...state, term: action.term };

        case FIND_ANALYSES.SUCCEEDED:
            return updateDocuments(state, action, "created_at", true);

        case GET_ANALYSIS.REQUESTED:
            return {
                ...state,
                detail: null,
                data: null
            };

        case GET_ANALYSIS.SUCCEEDED: {
            const { data } = action;
            const formatted = formatData(data);

            return {
                ...state,
                activeId: formatted.results[0].index,
                data: formatted,
                detail: data,
                searchIds: null,
                sortKey: "length"
            };
        }

        case CLEAR_ANALYSIS:
            return {
                ...state,
                data: null,
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

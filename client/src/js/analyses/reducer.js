import { sortBy, map, concat, forEach, slice } from "lodash-es";
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
} from "../app/actionTypes";
import { update, remove, updateDocuments } from "../utils/reducers";
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
    showMedian: true,
    showReads: false
};

export const addDepth = (data, showMedian) =>
    map(data, item => ({
        ...item,
        depth: showMedian ? item.medianDepth : item.meanDepth,
        isolates: map(item.isolates, isolate => ({
            ...isolate,
            depth: showMedian ? isolate.medianDepth : isolate.meanDepth
        }))
    }));

export const collapse = state =>
    map(state.data, item => ({
        ...item,
        expanded: false
    }));

export const toggleMedian = state => {
    const showMedian = !state.showMedian;

    const data = addDepth(state.data, showMedian);

    return { ...state, data, showMedian };
};

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

export const insert = (documents, action, sampleId) => {
    const beforeList = documents ? slice(documents, 0, documents.length) : [];

    forEach(documents, (document, i) => {
        if (document.placeholder && document.sampleId === sampleId && document.userId === action.data.user.id) {
            beforeList.splice(i, 1);
            return false;
        }
    });

    let newList = concat(beforeList, [{ ...action.data }]);
    newList = sortBy(newList, "created_at");

    return newList;
};

export default function samplesReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_ANALYSIS:
            if (action.data.sample.id === state.sampleId) {
                return {
                    ...state,
                    documents: insert(state.documents, action, state, state.sortKey, state.sortDescending)
                };
            }

            return state;

        case WS_UPDATE_ANALYSIS:
            if (action.data.sample.id === state.sampleId) {
                return update(state, action);
            }

            return state;

        case WS_REMOVE_ANALYSIS:
            return remove(state, action);

        case ANALYZE.REQUESTED:
            return {
                ...state,
                documents:
                    state.documents === null
                        ? null
                        : concat(state.documents, [
                              {
                                  ...action.placeholder,
                                  userId: action.userId,
                                  sampleId: action.sampleId
                              }
                          ])
            };

        case COLLAPSE_ANALYSIS:
            return { ...state, data: collapse(state) };

        case SET_PATHOSCOPE_FILTER:
            return setFilter(state, action.key);

        case TOGGLE_SHOW_PATHOSCOPE_MEDIAN:
            return toggleMedian(state);

        case TOGGLE_SHOW_PATHOSCOPE_READS:
            return { ...state, showReads: !state.showReads };

        case TOGGLE_SORT_PATHOSCOPE_DESCENDING:
            return { ...state, sortDescending: !state.sortDescending };

        case SET_PATHOSCOPE_SORT_KEY:
            return { ...state, sortKey: action.key };

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
            let data;

            if (action.data.algorithm === "pathoscope_bowtie" && action.data.ready) {
                data = addDepth(formatData(action.data), state.showMedian);
            } else {
                data = action.data;
            }

            return {
                ...state,
                detail: action.data,
                data
            };
        }

        case CLEAR_ANALYSIS:
            return {
                ...state,
                data: null,
                detail: null
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

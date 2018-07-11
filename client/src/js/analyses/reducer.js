import {filter, isEqual, map, reject} from "lodash-es";
import {
    ANALYZE,
    BLAST_NUVS,
    CLEAR_ANALYSIS,
    COLLAPSE_ANALYSIS,
    FIND_ANALYSES,
    GET_ANALYSIS,
    LIST_READY_INDEXES,
    REMOVE_ANALYSIS,
    SET_PATHOSCOPE_SORT_KEY,
    TOGGLE_ANALYSIS_EXPANDED,
    TOGGLE_SORT_PATHOSCOPE_DESCENDING,
    TOGGLE_SHOW_PATHOSCOPE_MEDIAN,
    TOGGLE_SHOW_PATHOSCOPE_READS, SET_PATHOSCOPE_FILTER
} from "../actionTypes";
import {formatData} from "./utils";

export const initialState = {
    documents: null,
    data: null,
    detail: null,
    readyIndexes: null,
    sortKey: "coverage",
    sortDescending: true,

    // Pathoscope-specific
    crop: false,
    cropped: null,
    filterOTUs: true,
    filterIsolates: true,
    showMedian: true,
    showReads: false
};

export const addDepth = (data, showMedian) => (
    map(data, item => ({
        ...item,
        depth: showMedian ? item.medianDepth : item.meanDepth,
        isolates: map(item.isolates, isolate => ({
            ...isolate,
            depth: showMedian ? isolate.medianDepth : isolate.meanDepth
        }))
    }))
);

export const collapse = (state) => (
    map(state.data, item => ({
        ...item,
        expanded: false
    }))
);

export const toggleMedian = (state) => {
    const showMedian = !state.showMedian;

    const data = addDepth(state.data, showMedian);

    return {...state, data, showMedian};
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
        return {...state, detail: {
            ...detail,
            results: map(detail.results, sequence => {
                if (sequence.index === sequenceIndex) {
                    return {...sequence, blast: data};
                }

                return sequence;
            })
        }};
    }

    return state;
};

export const toggleExpanded = (state, id) => (
    map(state.data, item => {
        if (item.id === id) {
            return {...item, expanded: !item.expanded};
        }

        return item;
    })
);

export default function samplesReducer (state = initialState, action) {

    switch (action.type) {

        case COLLAPSE_ANALYSIS:
            return {...state, data: collapse(state)};

        case SET_PATHOSCOPE_FILTER:
            return setFilter(state, action.key);

        case TOGGLE_SHOW_PATHOSCOPE_MEDIAN:
            return toggleMedian(state);

        case TOGGLE_SHOW_PATHOSCOPE_READS:
            return {...state, showReads: !state.showReads};

        case TOGGLE_SORT_PATHOSCOPE_DESCENDING:
            return {...state, sortDescending: !state.sortDescending};

        case SET_PATHOSCOPE_SORT_KEY:
            return {...state, sortKey: action.key};

        case TOGGLE_ANALYSIS_EXPANDED:
            return {...state, data: toggleExpanded(state, action.id)};

        case LIST_READY_INDEXES.SUCCEEDED:
            return {...state, readyIndexes: action.data};

        case FIND_ANALYSES.REQUESTED:
            return {...state, documents: null, detail: null};

        case FIND_ANALYSES.SUCCEEDED:
            return {...state, documents: action.data.documents};

        case GET_ANALYSIS.REQUESTED:
            return {
                ...state,
                detail: null,
                data: null,
                croppedData: null
            };

        case GET_ANALYSIS.SUCCEEDED: {
            const data = addDepth(formatData(action.data), state.showMedian);

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

        case ANALYZE.REQUESTED:
            return {
                ...state,
                documents: state.documents === null ? null : state.documents.concat([action.placeholder])
            };

        case ANALYZE.SUCCEEDED: {
            let analyses = state.documents;

            if (analyses !== null) {
                analyses = map(analyses, analysis => {
                    if (isEqual(analysis, action.placeholder)) {
                        return action.data;
                    }

                    return analysis;
                });
            }

            return {...state, documents: analyses};
        }

        case ANALYZE.FAILED:
            return {
                ...state,
                documents: state.documents === null ? null : filter(state.documents,
                    analysis => !isEqual(analysis, action.placeholder)
                )
            };

        case BLAST_NUVS.REQUESTED:
            return setNuvsBLAST(state, action.analysisId, action.sequenceIndex, {ready: false});

        case BLAST_NUVS.SUCCEEDED:
            return setNuvsBLAST(state, action.analysisId, action.sequenceIndex, action.data);

        case REMOVE_ANALYSIS.SUCCEEDED:
            if (state.documents === null) {
                return state;
            }

            return {
                ...state,
                documents: reject(state.documents, {id: action.id})
            };

        default:
            return state;
    }
}

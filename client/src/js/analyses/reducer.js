import { filter, map, reject, isEqual } from "lodash-es";
import {
    FIND_ANALYSES,
    GET_ANALYSIS,
    CLEAR_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,
    REMOVE_ANALYSIS,
    GET_ANALYSIS_PROGRESS,
    LIST_READY_INDEXES
} from "../actionTypes";

export const initialState = {
    documents: null,
    detail: null,
    getAnalysisProgress: 0,
    readyIndexes: null
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

export default function samplesReducer (state = initialState, action) {

    switch (action.type) {

        case LIST_READY_INDEXES.SUCCEEDED:
            return {...state, readyIndexes: action.data};

        case FIND_ANALYSES.REQUESTED:
            return {...state, documents: null, detail: null};

        case FIND_ANALYSES.SUCCEEDED:
            return {...state, documents: action.data.documents};

        case GET_ANALYSIS.REQUESTED:
            return {...state, detail: null, getAnalysisProgress: 0};

        case GET_ANALYSIS.SUCCEEDED:
            return {...state, detail: action.data};

        case GET_ANALYSIS_PROGRESS:
            return {...state, getAnalysisProgress: action.progress};

        case CLEAR_ANALYSIS:
            return {...state, getAnalysisProgress: 0, detail: null};

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

            return {...state, documents: reject(state.documents, {id: action.id})};

        default:
            return state;
    }
}

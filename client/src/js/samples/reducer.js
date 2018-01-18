import { reject } from "lodash";
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

const initialState = {
    documents: null,
    detail: null,
    analyses: null,
    analysisDetail: null,
    getAnalysisProgress: 0,
    showEdit: false,
    showRemove: false,
    editError: false,
    reservedFiles: [],
    readyHosts: null
};

const setNuvsBLAST = (state, analysisId, sequenceIndex, data = "ip") => {
    const analysisDetail = state.analysisDetail;

    if (analysisDetail.id === analysisId) {
        return {...state, analysisDetail: {
            ...analysisDetail,
            results: analysisDetail.results.map(sequence => {
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

        case FIND_SAMPLES.SUCCEEDED:
            return {...state, ...action.data};

        case FIND_READY_HOSTS.SUCCEEDED:
            return {...state, readyHosts: action.data.documents};

        case GET_SAMPLE.REQUESTED:
            return {...state, detail: null, analyses: null, analysisDetail: null};

        case GET_SAMPLE.SUCCEEDED:
            return {...state, detail: action.data};

        case UPDATE_SAMPLE.SUCCEEDED: {
            if (state.list === null) {
                return state;
            }

            return {...state, documents: state.documents.map(sample =>
                sample.id === action.data.id ? {...sample, ...action.data} : sample
            )};
        }

        case REMOVE_SAMPLE.SUCCEEDED:
            return {...state, detail: null, analyses: null, analysisDetail: null};

        case SHOW_REMOVE_SAMPLE:
            return {...state, showRemove: true};

        case HIDE_SAMPLE_MODAL:
            return {...state, showRemove: false};

        case FIND_ANALYSES.REQUESTED:
            return {...state, analyses: null, analysisDetail: null};

        case FIND_ANALYSES.SUCCEEDED:
            return {...state, analyses: action.data.documents};

        case GET_ANALYSIS.REQUESTED:
            return {...state, analysisDetail: null, getAnalysisProgress: 0};

        case GET_ANALYSIS.SUCCEEDED:
            return {...state, analysisDetail: action.data};

        case GET_ANALYSIS_PROGRESS:
            return {...state, getAnalysisProgress: action.progress};

        case ANALYZE.SUCCEEDED:
            return {...state, analyses: state.analyses === null ? null : state.analyses.concat([action.data])};

        case BLAST_NUVS.REQUESTED:
            return setNuvsBLAST(state, action.analysisId, action.sequenceIndex, {ready: false});

        case BLAST_NUVS.SUCCEEDED:
            return setNuvsBLAST(state, action.analysisId, action.sequenceIndex, action.data);

        case REMOVE_ANALYSIS.SUCCEEDED:
            if (state.analyses === null) {
                return state;
            }

            return {...state, analyses: reject(state.analyses, {id: action.id})};

        default:
            return state;
    }
}

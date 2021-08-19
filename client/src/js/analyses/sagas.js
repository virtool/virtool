import { select, takeEvery, takeLatest, throttle } from "redux-saga/effects";
import {
    ANALYZE,
    BLAST_NUVS,
    FIND_ANALYSES,
    GET_ANALYSIS,
    REMOVE_ANALYSIS,
    WS_UPDATE_ANALYSIS
} from "../app/actionTypes";
import { apiCall, pushFindTerm } from "../utils/sagas";
import * as analysesAPI from "./api";
import { getAnalysisDetailId } from "./selectors";

export function* watchAnalyses() {
    yield takeLatest(WS_UPDATE_ANALYSIS, wsUpdateAnalysis);
    yield takeLatest(FIND_ANALYSES.REQUESTED, findAnalyses);
    yield takeLatest(GET_ANALYSIS.REQUESTED, getAnalysis);
    yield takeEvery(ANALYZE.REQUESTED, analyze);
    yield throttle(150, BLAST_NUVS.REQUESTED, blastNuvs);
    yield takeLatest(REMOVE_ANALYSIS.REQUESTED, removeAnalysis);
}

export function* wsUpdateAnalysis(action) {
    const analysisId = yield select(getAnalysisDetailId);

    if (analysisId === action.data.id) {
        yield apiCall(analysesAPI.get, { analysisId }, GET_ANALYSIS);
    }
}

export function* findAnalyses(action) {
    yield apiCall(analysesAPI.find, action, FIND_ANALYSES);
    yield pushFindTerm(action.term);
}

export function* getAnalysis(action) {
    yield apiCall(analysesAPI.get, action, GET_ANALYSIS);
}

export function* analyze(action) {
    yield apiCall(analysesAPI.analyze, action, ANALYZE);
}

export function* blastNuvs(action) {
    yield apiCall(analysesAPI.blastNuvs, action, BLAST_NUVS, {
        analysisId: action.analysisId,
        sequenceIndex: action.sequenceIndex
    });
}

export function* removeAnalysis(action) {
    yield apiCall(analysesAPI.remove, action, REMOVE_ANALYSIS);
}

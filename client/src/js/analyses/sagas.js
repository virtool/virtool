import { get } from "lodash-es";
import { ANALYZE, BLAST_NUVS, FIND_ANALYSES, GET_ANALYSIS, REMOVE_ANALYSIS } from "../app/actionTypes";
import { apiCall, pushFindTerm } from "../utils/sagas";

import * as analysesAPI from "./api";
import { takeEvery, takeLatest, throttle } from "redux-saga/effects";

export const getAnalysisDetailId = state => get(state, "analysis.detail.id", null);

export function* watchAnalyses() {
    yield takeLatest(FIND_ANALYSES.REQUESTED, findAnalyses);
    yield takeLatest(GET_ANALYSIS.REQUESTED, getAnalysis);
    yield takeEvery(ANALYZE.REQUESTED, analyze);
    yield throttle(150, BLAST_NUVS.REQUESTED, blastNuvs);
    yield takeLatest(REMOVE_ANALYSIS.REQUESTED, removeAnalysis);
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
    yield apiCall(analysesAPI.remove, action, REMOVE_ANALYSIS, {
        id: action.analysisId
    });
}

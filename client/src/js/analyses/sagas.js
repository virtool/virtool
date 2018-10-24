import { get } from "lodash-es";
import {
  ANALYZE,
  BLAST_NUVS,
  FIND_ANALYSES,
  FILTER_ANALYSES,
  GET_ANALYSIS,
  REMOVE_ANALYSIS
} from "../actionTypes";
import { apiCall } from "../sagaUtils";

import * as analysesAPI from "./api";
import { takeEvery, takeLatest, throttle } from "redux-saga/effects";

export const getAnalysisDetailId = state =>
  get(state, "analysis.detail.id", null);

export function* watchAnalyses() {
  yield takeLatest(FIND_ANALYSES.REQUESTED, findAnalyses);
  yield takeLatest(FILTER_ANALYSES.REQUESTED, filterAnalyses);
  yield takeLatest(GET_ANALYSIS.REQUESTED, getAnalysis);
  yield takeEvery(ANALYZE.REQUESTED, analyze);
  yield throttle(150, BLAST_NUVS.REQUESTED, blastNuvs);
  yield takeLatest(REMOVE_ANALYSIS.REQUESTED, removeAnalysis);
}

export function* findAnalyses(action) {
  yield apiCall(analysesAPI.findAnalyses, action, FIND_ANALYSES);
}

export function* filterAnalyses(action) {
  yield apiCall(analysesAPI.filter, action, FILTER_ANALYSES);
}

export function* getAnalysis(action) {
  yield apiCall(analysesAPI.getAnalysis, action, GET_ANALYSIS);
}

export function* analyze(action) {
  yield apiCall(analysesAPI.analyze, action, ANALYZE, {
    placeholder: action.placeholder
  });
}

export function* blastNuvs(action) {
  yield apiCall(analysesAPI.blastNuvs, action, BLAST_NUVS, {
    analysisId: action.analysisId,
    sequenceIndex: action.sequenceIndex
  });
}

export function* removeAnalysis(action) {
  yield apiCall(analysesAPI.removeAnalysis, action, REMOVE_ANALYSIS, {
    id: action.analysisId
  });
}

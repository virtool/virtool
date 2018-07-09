import { get, noop } from "lodash-es";
import { buffers, END, eventChannel } from "redux-saga";
import { call, put, select, take, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import * as analysesAPI from "./api";
import { getAnalysisProgress } from "./actions";
import { apiCall, putGenericError } from "../sagaUtils";
import {
    WS_UPDATE_ANALYSIS,
    FIND_ANALYSES,
    GET_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,
    REMOVE_ANALYSIS
} from "../actionTypes";

export const getAnalysisDetailId = (state) => get(state, "samples.analysisDetail.id", null);

export function* watchAnalyses () {
    yield takeEvery(WS_UPDATE_ANALYSIS, wsUpdateAnalysis);
    yield takeLatest(FIND_ANALYSES.REQUESTED, findAnalyses);
    yield takeLatest(GET_ANALYSIS.REQUESTED, getAnalysis);
    yield takeEvery(ANALYZE.REQUESTED, analyze);
    yield throttle(150, BLAST_NUVS.REQUESTED, blastNuvs);
    yield takeLatest(REMOVE_ANALYSIS.REQUESTED, removeAnalysis);
}

export function* wsUpdateAnalysis (action) {
    const currentAnalysisId = yield select(getAnalysisDetailId);

    if (currentAnalysisId === action.update.id) {
        yield getAnalysis({ analysisId: currentAnalysisId });
    }
}

export function* findAnalyses (action) {
    yield apiCall(analysesAPI.findAnalyses, action, FIND_ANALYSES);
}

const createGetAnalysisChannel = (analysisId) => (
    eventChannel(emitter => {
        const onProgress = (e) => {
            if (e.lengthComputable) {
                emitter({progress: e.percent});
            }
        };

        const onSuccess = (response) => {
            emitter({response});
            emitter(END);
        };

        const onFailure = (err) => {
            emitter({err});
            emitter(END);
        };

        analysesAPI.getAnalysis(analysisId, onProgress, onSuccess, onFailure);

        return noop;
    }, buffers.sliding(2))
);

export function* getAnalysis (action) {
    const channel = yield call(createGetAnalysisChannel, action.analysisId);

    while (true) {
        const { progress = 0, response, err } = yield take(channel);

        if (err) {
            return yield put(putGenericError(GET_ANALYSIS, err));
        }

        if (response) {
            return yield put({type: GET_ANALYSIS.SUCCEEDED, data: response.body});
        }

        yield put(getAnalysisProgress(progress));
    }
}

export function* analyze (action) {
    yield apiCall(analysesAPI.analyze, action, ANALYZE, {placeholder: action.placeholder});
}

export function* blastNuvs (action) {
    yield apiCall(analysesAPI.blastNuvs, action, BLAST_NUVS, {
        analysisId: action.analysisId,
        sequenceIndex: action.sequenceIndex
    });
}

export function* removeAnalysis (action) {
    yield apiCall(analysesAPI.removeAnalysis, action, REMOVE_ANALYSIS, {id: action.analysisId});
}

import { includes, noop } from "lodash-es";
import { LOCATION_CHANGE, push } from "react-router-redux";
import { buffers, END, eventChannel } from "redux-saga";
import { call, put, select, take, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import * as samplesAPI from "./api";
import { getAnalysisProgress } from "./actions";
import { apiCall, apiFind, pushHistoryState, putGenericError, setPending } from "../sagaUtils";
import {
    WS_UPDATE_SAMPLE,
    WS_REMOVE_SAMPLE,
    WS_UPDATE_ANALYSIS,
    FIND_SAMPLES,
    FIND_READY_HOSTS,
    GET_SAMPLE,
    REFRESH_SAMPLE,
    CREATE_SAMPLE,
    UPDATE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    REMOVE_SAMPLE,
    FIND_ANALYSES,
    GET_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,
    REMOVE_ANALYSIS
} from "../actionTypes";

export function* watchSamples () {
    yield throttle(200, LOCATION_CHANGE, findSamples);
    yield takeEvery(WS_UPDATE_SAMPLE, wsSample);
    yield takeEvery(WS_REMOVE_SAMPLE, wsSample);
    yield takeEvery(WS_UPDATE_ANALYSIS, wsUpdateAnalysis);
    yield takeLatest(FIND_READY_HOSTS.REQUESTED, findReadyHosts);
    yield takeLatest(REFRESH_SAMPLE.REQUESTED, getSample);
    yield takeLatest(GET_SAMPLE.REQUESTED, getSample);
    yield takeLatest(CREATE_SAMPLE.REQUESTED, createSample);
    yield takeEvery(UPDATE_SAMPLE.REQUESTED, updateSample);
    yield takeEvery(UPDATE_SAMPLE_RIGHTS.REQUESTED, updateSampleRights);
    yield throttle(300, REMOVE_SAMPLE.REQUESTED, removeSample);
    yield takeLatest(FIND_ANALYSES.REQUESTED, findAnalyses);
    yield takeLatest(GET_ANALYSIS.REQUESTED, getAnalysis);
    yield takeEvery(ANALYZE.REQUESTED, analyze);
    yield throttle(150, BLAST_NUVS.REQUESTED, blastNuvs);
    yield takeLatest(REMOVE_ANALYSIS.REQUESTED, removeAnalysis);
}

export function* wsSample () {
    yield apiCall(samplesAPI.find, {}, FIND_SAMPLES);
}

export function* wsUpdateAnalysis (action) {
    yield getAnalysis({analysisId: action.update.id});
}

export function* findSamples (action) {
    yield apiFind("/samples", samplesAPI.find, action, FIND_SAMPLES);
}

export function* findReadyHosts () {
    yield apiCall(samplesAPI.findReadyHosts, {}, FIND_READY_HOSTS);
}

export function* getSample (action) {
    try {
        const response = yield samplesAPI.get(action);

        const account = yield select(state => state.account);

        const data = response.body;

        const canModify = (
            data.user.id === account.id ||
            data.all_write ||
            data.group_write && includes(account.groups, data.group)
        );

        yield put({type: GET_SAMPLE.SUCCEEDED, data: {...response.body, canModify}});
    } catch (error) {
        yield putGenericError(GET_SAMPLE, error);
    }
}

export function* createSample (action) {
    yield setPending(apiCall(samplesAPI.create, action, CREATE_SAMPLE));
}

export function* updateSample (action) {
    yield setPending(apiCall(samplesAPI.update, action, UPDATE_SAMPLE));
    yield getSample(action);
    yield pushHistoryState({editSample: false});
}

export function* updateSampleRights (action) {
    yield setPending(apiCall(samplesAPI.updateRights, action, UPDATE_SAMPLE_RIGHTS));
    yield getSample(action);
}

export function* removeSample (action) {
    yield setPending(apiCall(samplesAPI.remove, action, REMOVE_SAMPLE));
    yield put(push("/samples"));
}

export function* findAnalyses (action) {
    yield apiCall(samplesAPI.findAnalyses, action, FIND_ANALYSES);
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

        samplesAPI.getAnalysis(analysisId, onProgress, onSuccess, onFailure);

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
    try {
        const response = yield samplesAPI.analyze(action);
        yield put({type: ANALYZE.SUCCEEDED, data: response.body, placeholder: action.placeholder});
        yield pushHistoryState({quickAnalyze: false});
    } catch (error) {
        yield putGenericError(ANALYZE, error);
    }
}

export function* blastNuvs (action) {
    try {
        const response = yield samplesAPI.blastNuvs(action);
        yield put({
            type: BLAST_NUVS.SUCCEEDED,
            analysisId: action.analysisId,
            sequenceIndex: action.sequenceIndex,
            data: response.body
        });
    } catch (error) {
        yield putGenericError(BLAST_NUVS, error);
    }
}

export function* removeAnalysis (action) {
    yield apiCall(samplesAPI.removeAnalysis, action, REMOVE_ANALYSIS, {id: action.analysisId});
}

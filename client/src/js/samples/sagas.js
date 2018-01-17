import { LOCATION_CHANGE } from "react-router-redux";
import { put, select, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import * as samplesAPI from "./api";
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
    UPDATE_SAMPLE_GROUP,
    UPDATE_SAMPLE_RIGHTS,
    REMOVE_SAMPLE,
    FIND_ANALYSES,
    GET_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,
    REMOVE_ANALYSIS
} from "../actionTypes";

export function* wsSample () {
    yield apiCall(samplesAPI.find, {}, FIND_SAMPLES);
}

export function* wsUpdateAnalysis (action) {
    yield getAnalysis(action);
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
            data.group_write && account.groups.includes(data.group)
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

export function* updateSampleGroup (action) {
    yield setPending(apiCall(samplesAPI.updateGroup, action, UPDATE_SAMPLE_GROUP));
    yield getSample(action);
}

export function* updateSampleRights (action) {
    yield setPending(apiCall(samplesAPI.updateRights, action, UPDATE_SAMPLE_RIGHTS));
    yield getSample(action);
}

export function* removeSample (action) {
    yield setPending(apiCall(samplesAPI.remove, action, REMOVE_SAMPLE));
    yield findSamples();
}

export function* findAnalyses (action) {
    yield apiCall(samplesAPI.findAnalyses, action, FIND_ANALYSES);
}

export function* getAnalysis (action) {
    yield apiCall(samplesAPI.getAnalysis, action, GET_ANALYSIS);
}

export function* analyze (action) {
    try {
        const response = yield samplesAPI.analyze(action);
        yield put({type: ANALYZE.SUCCEEDED, data: response.body});
        yield pushHistoryState({quickAnalyze: false});
    } catch (error) {
        yield putGenericError(ANALYZE, error);
    }
}

export function* blastNuvs (action) {
    try {
        const response = yield samplesAPI.blastNuvs(action.analysisId, action.sequenceIndex);
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
    yield takeEvery(UPDATE_SAMPLE_GROUP.REQUESTED, updateSampleGroup);
    yield takeEvery(UPDATE_SAMPLE_RIGHTS.REQUESTED, updateSampleRights);
    yield throttle(300, REMOVE_SAMPLE.REQUESTED, removeSample);
    yield takeLatest(FIND_ANALYSES.REQUESTED, findAnalyses);
    yield takeLatest(GET_ANALYSIS.REQUESTED, getAnalysis);
    yield takeEvery(ANALYZE.REQUESTED, analyze);
    yield throttle(150, BLAST_NUVS.REQUESTED, blastNuvs);
    yield takeLatest(REMOVE_ANALYSIS.REQUESTED, removeAnalysis);
}

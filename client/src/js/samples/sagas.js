/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { call, put, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import samplesAPI from "./api";
import { setPending } from "../wrappers";
import { FIND_SAMPLES, GET_SAMPLE, UPDATE_SAMPLE, FIND_ANALYSES, GET_ANALYSIS, ANALYZE }  from "../actionTypes";

export function* watchSamples () {
    yield throttle(500, FIND_SAMPLES.REQUESTED, findSamples);
    yield takeLatest(GET_SAMPLE.REQUESTED, getSample);
    yield takeEvery(UPDATE_SAMPLE.REQUESTED, updateSample);
    yield takeLatest(FIND_ANALYSES.REQUESTED, findAnalyses);
    yield takeLatest(GET_ANALYSIS.REQUESTED, getAnalysis);
    yield takeEvery(ANALYZE.REQUESTED, analyze);
}

export function* findSamples (action) {
    yield setPending(function* (action) {
        try {
            const response = yield call(samplesAPI.find, action.term, action.page);
            yield put({type: FIND_SAMPLES.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: FIND_SAMPLES.FAILED, error});
        }
    }, action);
}

export function* getSample (action) {
    try {
        const response = yield call(samplesAPI.get, action.sampleId);
        yield put({type: GET_SAMPLE.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_SAMPLE.FAILED, error});
    }
}

export function* updateSample (action) {
    yield setPending(function* (action) {
        try {
            const response = yield call(samplesAPI.update, action.sampleId, action.update);
            yield put({type: UPDATE_SAMPLE.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: UPDATE_SAMPLE.FAILED, error});
        }
    }, action);
}

export function* findAnalyses (action) {
    try {
        const response = yield call(samplesAPI.findAnalyses, action.sampleId);
        yield put({type: FIND_ANALYSES.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: FIND_ANALYSES.FAILED, error});
    }
}

export function* getAnalysis (action) {
    yield setPending(function* (action) {
        try {
            const response = yield call(samplesAPI.getAnalysis, action.analysisId);
            yield put({type: GET_ANALYSIS.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: GET_ANALYSIS.FAILED, error});
        }
    }, action);
}

export function* analyze (action) {
    try {
        const response = yield call(samplesAPI.analyze, action.sampleId, action.algorithm);
        yield put({type: ANALYZE.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: ANALYZE.FAILED, error});
    }
}

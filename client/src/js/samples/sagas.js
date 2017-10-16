/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { takeEvery, takeLatest, throttle, put } from "redux-saga/effects";

import samplesAPI from "./api";
import { setPending } from "../wrappers";
import {
    FIND_SAMPLES,
    FIND_READY_HOSTS,
    GET_SAMPLE,
    CREATE_SAMPLE,
    UPDATE_SAMPLE,
    FIND_ANALYSES,
    GET_ANALYSIS,
    ANALYZE,
    BLAST_NUVS
}  from "../actionTypes";

export function* watchSamples () {
    yield takeLatest(FIND_SAMPLES.REQUESTED, findSamples);
    yield takeLatest(FIND_READY_HOSTS.REQUESTED, findReadyHosts);
    yield takeLatest(GET_SAMPLE.REQUESTED, getSample);
    yield takeLatest(CREATE_SAMPLE.REQUESTED, createSample);
    yield takeEvery(UPDATE_SAMPLE.REQUESTED, updateSample);
    yield takeLatest(FIND_ANALYSES.REQUESTED, findAnalyses);
    yield takeLatest(GET_ANALYSIS.REQUESTED, getAnalysis);
    yield takeEvery(ANALYZE.REQUESTED, analyze);
    yield throttle(150, BLAST_NUVS.REQUESTED, blastNuvs);
}

export function* findSamples (action) {
    yield setPending(function* (action) {
        try {
            const response = yield samplesAPI.find(action.term, action.page);
            yield put({type: FIND_SAMPLES.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: FIND_SAMPLES.FAILED, error});
        }
    }, action);
}

export function* findReadyHosts () {
    try {
        const response = yield samplesAPI.findReadyHosts();
        yield put({type: FIND_READY_HOSTS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: FIND_READY_HOSTS.FAILED, error});
    }
}

export function* getSample (action) {
    try {
        const response = yield samplesAPI.get(action.sampleId);
        yield put({type: GET_SAMPLE.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_SAMPLE.FAILED, error});
    }
}

export function* createSample (action) {
    yield setPending(function* ({name, isolate, host, locale, subtraction, files}) {
        try {
        const response = yield samplesAPI.create(name, isolate, host, locale, subtraction, files);
        yield put({type: GET_SAMPLE.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: GET_SAMPLE.FAILED, error});
    }
    }, action);
}

export function* updateSample (action) {
    yield setPending(function* (action) {
        try {
            const response = yield samplesAPI.update(action.sampleId, action.update);
            yield put({type: UPDATE_SAMPLE.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: UPDATE_SAMPLE.FAILED, error});
        }
    }, action);
}

export function* findAnalyses (action) {
    try {
        const response = yield samplesAPI.findAnalyses(action.sampleId);
        yield put({type: FIND_ANALYSES.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: FIND_ANALYSES.FAILED, error});
    }
}

export function* getAnalysis (action) {
    yield setPending(function* (action) {
        try {
            const response = yield samplesAPI.getAnalysis(action.analysisId);
            yield put({type: GET_ANALYSIS.SUCCEEDED, data: response.body});
        } catch (error) {
            yield put({type: GET_ANALYSIS.FAILED, error});
        }
    }, action);
}

export function* analyze (action) {
    try {
        const response = yield samplesAPI.analyze(action.sampleId, action.algorithm);
        yield put({type: ANALYZE.SUCCEEDED, data: response.body});
    } catch (error) {
        yield put({type: ANALYZE.FAILED, error});
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
    } catch (err) {
        yield put({type: BLAST_NUVS.FAILED, err});
    }
}

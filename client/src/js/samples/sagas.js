import { push } from "react-router-redux";
import { put, select, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import samplesAPI from "./api";
import { pushHistoryState, putGenericError, setPending } from "../sagaHelpers";
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

export function* wsUpdateAnalysis (action) {
    try {
        const response = yield samplesAPI.getAnalysis(action.update.id);
        yield put({type: GET_ANALYSIS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield putGenericError(GET_ANALYSIS, error);
    }
}

export function* findSamples (action) {
    yield setPending(function* (action) {
        try {
            const response = yield samplesAPI.find(action.term, action.page);
            yield put({type: FIND_SAMPLES.SUCCEEDED, data: response.body});
        } catch (error) {
            yield putGenericError(FIND_SAMPLES, error);
        }
    }, action);
}

export function* findReadyHosts () {
    try {
        const response = yield samplesAPI.findReadyHosts();
        yield put({type: FIND_READY_HOSTS.SUCCEEDED, data: response.body});
    } catch (error) {
        yield putGenericError(FIND_READY_HOSTS, error);
    }
}

export function* getSample (action) {
    try {
        const response = yield samplesAPI.get(action.sampleId);

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
    yield setPending(function* ({name, isolate, host, locale, subtraction, files}) {
        try {
            const response = yield samplesAPI.create(name, isolate, host, locale, subtraction, files);
            yield put({type: CREATE_SAMPLE.SUCCEEDED, data: response.body});
        } catch (error) {
            yield putGenericError(CREATE_SAMPLE, error);
        }
    }, action);
}

export function* updateSample (action) {
    yield setPending(function* (action) {
        try {
            yield samplesAPI.update(action.sampleId, action.update);
            yield put({type: REFRESH_SAMPLE.REQUESTED, sampleId: action.sampleId});
            yield pushHistoryState({editSample: false});
        } catch (error) {
            yield putGenericError(UPDATE_SAMPLE, error);
        }
    }, action);
}

export function* updateSampleGroup (action) {
    yield setPending(function* (action) {
        try {
            yield samplesAPI.updateGroup(action.sampleId, action.groupId);
            yield put({type: GET_SAMPLE.REQUESTED, sampleId: action.sampleId});
        } catch (error) {
            yield putGenericError(UPDATE_SAMPLE_GROUP, error);
        }
    }, action);
}

export function* updateSampleRights (action) {
    yield setPending(function* (action) {
        try {
            yield samplesAPI.updateRights(action.sampleId, action.update);
            yield put({type: GET_SAMPLE.REQUESTED, sampleId: action.sampleId});
        } catch (error) {
            yield putGenericError(UPDATE_SAMPLE_RIGHTS, error);
        }
    }, action);
}

export function* removeSample (action) {
    yield setPending(function* (action) {
        try {
            yield samplesAPI.remove(action.sampleId);
            yield put({type: FIND_SAMPLES.REQUESTED});

            yield put(push("/samples"));
        } catch (error) {
            yield putGenericError(REMOVE_SAMPLE, error);
        }
    }, action);
}

export function* findAnalyses (action) {
    try {
        const response = yield samplesAPI.findAnalyses(action.sampleId);
        yield put({type: FIND_ANALYSES.SUCCEEDED, data: response.body});
    } catch (error) {
        yield putGenericError(FIND_ANALYSES, error);
    }
}

export function* getAnalysis (action) {
    yield setPending(function* (action) {
        try {
            const response = yield samplesAPI.getAnalysis(action.analysisId);
            yield put({type: GET_ANALYSIS.SUCCEEDED, data: response.body});
        } catch (error) {
            yield putGenericError(GET_ANALYSIS, error);
        }
    }, action);
}

export function* analyze (action) {
    try {
        const response = yield samplesAPI.analyze(action.sampleId, action.algorithm);
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
    yield setPending(function* (action) {
        try {
            yield samplesAPI.removeAnalysis(action.analysisId);
            yield put({type: REMOVE_ANALYSIS.SUCCEEDED, id: action.analysisId});
        } catch (error) {
            yield putGenericError(REMOVE_ANALYSIS, error);
        }
    }, action);
}

export function* watchSamples () {
    yield takeEvery(WS_UPDATE_SAMPLE, findSamples);
    yield takeEvery(WS_REMOVE_SAMPLE, findSamples);
    yield takeEvery(WS_UPDATE_ANALYSIS, wsUpdateAnalysis);
    yield takeLatest(FIND_SAMPLES.REQUESTED, findSamples);
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

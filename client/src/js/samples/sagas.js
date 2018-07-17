import { get, includes } from "lodash-es";
import { push } from "react-router-redux";
import { put, select, takeEvery, takeLatest, throttle } from "redux-saga/effects";

import * as samplesAPI from "./api";
import * as filesAPI from "../files/api";
import { apiCall, putGenericError, setPending } from "../sagaUtils";
import {
    FILTER_SAMPLES,
    FIND_READ_FILES,
    FIND_READY_HOSTS,
    GET_SAMPLE,
    CREATE_SAMPLE,
    UPDATE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    REMOVE_SAMPLE,
    LIST_SAMPLES,
    FIND_ANALYSES
} from "../actionTypes";

export const getSampleDetailId = (state) => get(state, "samples.detail.id", null);

export function* watchSamples () {
    yield takeLatest(LIST_SAMPLES.REQUESTED, listSamples);
    yield takeLatest(FILTER_SAMPLES.REQUESTED, filterSamples);
    yield takeLatest(FIND_READY_HOSTS.REQUESTED, findReadyHosts);
    yield takeLatest(FIND_READ_FILES.REQUESTED, findReadFiles);
    yield takeLatest(GET_SAMPLE.REQUESTED, getSample);
    yield takeLatest(CREATE_SAMPLE.REQUESTED, createSample);
    yield takeEvery(UPDATE_SAMPLE.REQUESTED, updateSample);
    yield takeEvery(UPDATE_SAMPLE_RIGHTS.REQUESTED, updateSampleRights);
    yield throttle(300, REMOVE_SAMPLE.REQUESTED, removeSample);
}

export function* filterSamples (action) {
    yield apiCall(samplesAPI.filter, action, FILTER_SAMPLES);
}

export function* listSamples (action) {
    yield apiCall(samplesAPI.list, action, LIST_SAMPLES);
}

export function* findReadFiles () {
    yield apiCall(filesAPI.find, {
        fileType: "reads",
        page: 1,
        perPage: 500
    }, FIND_READ_FILES);
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
        yield put({type: FIND_ANALYSES.REQUESTED, sampleId: action.sampleId});
    } catch (error) {
        yield putGenericError(GET_SAMPLE, error);
    }
}

export function* createSample (action) {
    const extraFunc = { closeModal: put(push({state: {create: false}})) };
    yield setPending(apiCall(samplesAPI.create, action, CREATE_SAMPLE, {}, extraFunc));
}

export function* updateSample (action) {
    const extraFunc = { closeModal: put(push({editSample: false})) };
    yield setPending(apiCall(samplesAPI.update, action, UPDATE_SAMPLE, {}, extraFunc));
}

export function* updateSampleRights (action) {
    yield setPending(apiCall(samplesAPI.updateRights, action, UPDATE_SAMPLE_RIGHTS));
}

export function* removeSample (action) {
    yield setPending(apiCall(samplesAPI.remove, action, REMOVE_SAMPLE));
    yield put(push("/samples"));
}

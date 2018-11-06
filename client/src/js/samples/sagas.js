import { includes } from "lodash-es";
import { push } from "react-router-redux";

import * as filesAPI from "../files/api";
import { apiCall, pushFindTerm, putGenericError, setPending } from "../utils/sagas";
import {
    FIND_SAMPLES,
    FIND_READ_FILES,
    FIND_READY_HOSTS,
    GET_SAMPLE,
    CREATE_SAMPLE,
    UPDATE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    REMOVE_SAMPLE
} from "../app/actionTypes";
import * as samplesAPI from "./api";
import { put, select, takeEvery, takeLatest, throttle } from "redux-saga/effects";

export function* watchSamples() {
    yield takeLatest(FIND_SAMPLES.REQUESTED, findSamples);
    yield takeLatest(FIND_READY_HOSTS.REQUESTED, findReadyHosts);
    yield takeLatest(FIND_READ_FILES.REQUESTED, findReadFiles);
    yield takeLatest(GET_SAMPLE.REQUESTED, getSample);
    yield takeLatest(CREATE_SAMPLE.REQUESTED, createSample);
    yield takeEvery(UPDATE_SAMPLE.REQUESTED, updateSample);
    yield takeEvery(UPDATE_SAMPLE_RIGHTS.REQUESTED, updateSampleRights);
    yield throttle(300, REMOVE_SAMPLE.REQUESTED, removeSample);
}

export function* findSamples(action) {
    yield apiCall(samplesAPI.find, action, FIND_SAMPLES);
    yield pushFindTerm(action.term);
}

export function* findReadFiles() {
    yield apiCall(
        filesAPI.find,
        {
            fileType: "reads",
            page: 1,
            perPage: 500
        },
        FIND_READ_FILES
    );
}

export function* findReadyHosts(action) {
    yield apiCall(samplesAPI.findReadyHosts, action, FIND_READY_HOSTS);
}

export function* getSample(action) {
    try {
        const response = yield samplesAPI.get(action);

        const account = yield select(state => state.account);

        const data = response.body;

        const canModify =
            data.user.id === account.id || data.all_write || (data.group_write && includes(account.groups, data.group));

        yield put({
            type: GET_SAMPLE.SUCCEEDED,
            data: { ...response.body, canModify }
        });
    } catch (error) {
        yield putGenericError(GET_SAMPLE, error);
    }
}

export function* createSample(action) {
    const extraFunc = { closeModal: put(push({ state: { create: false } })) };
    yield setPending(apiCall(samplesAPI.create, action, CREATE_SAMPLE, {}, extraFunc));
}

export function* updateSample(action) {
    const extraFunc = { closeModal: put(push({ editSample: false })) };
    yield setPending(apiCall(samplesAPI.update, action, UPDATE_SAMPLE, {}, extraFunc));
}

export function* updateSampleRights(action) {
    yield setPending(apiCall(samplesAPI.updateRights, action, UPDATE_SAMPLE_RIGHTS));
}

export function* removeSample(action) {
    yield setPending(apiCall(samplesAPI.remove, action, REMOVE_SAMPLE));
    yield put(push("/samples"));
}

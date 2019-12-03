import { push } from "connected-react-router";
import { includes } from "lodash-es";
import { call, put, select, takeEvery, takeLatest, throttle } from "redux-saga/effects";
import {
    CREATE_SAMPLE,
    FIND_READ_FILES,
    FIND_SAMPLES,
    GET_SAMPLE,
    REMOVE_SAMPLE,
    UPDATE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    UPLOAD_SAMPLE_FILE,
    WS_UPDATE_SAMPLE
} from "../app/actionTypes";
import * as filesAPI from "../files/api";
import { createUploadChannel, watchUploadChannel } from "../files/sagas";
import { apiCall, putGenericError, setPending } from "../utils/sagas";
import * as samplesAPI from "./api";
import { getSampleDetailId } from "./selectors";
import { createFindURL } from "./utils";

export function* watchSamples() {
    yield throttle(300, FIND_SAMPLES.REQUESTED, findSamples);
    yield takeLatest(FIND_READ_FILES.REQUESTED, findReadFiles);
    yield takeLatest(GET_SAMPLE.REQUESTED, getSample);
    yield throttle(500, CREATE_SAMPLE.REQUESTED, createSample);
    yield takeEvery(UPDATE_SAMPLE.REQUESTED, updateSample);
    yield takeEvery(UPDATE_SAMPLE_RIGHTS.REQUESTED, updateSampleRights);
    yield takeEvery(UPLOAD_SAMPLE_FILE.REQUESTED, uploadSampleFile);
    yield throttle(300, REMOVE_SAMPLE.REQUESTED, removeSample);
    yield takeEvery(WS_UPDATE_SAMPLE, wsUpdateSample);
}

export function* wsUpdateSample(action) {
    const sampleDetailId = yield select(getSampleDetailId);
    if (action.data.id === sampleDetailId) {
        yield apiCall(samplesAPI.get, { sampleId: sampleDetailId }, GET_SAMPLE);
    }
}

export function* findSamples(action) {
    yield apiCall(samplesAPI.find, action, FIND_SAMPLES);

    const { term, pathoscope, nuvs } = action;

    const { pathname, search } = createFindURL(term, pathoscope, nuvs);

    yield put(push(pathname + search));
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

export function* uploadSampleFile(action) {
    const { localId, sampleId } = action;
    const channel = yield call(createUploadChannel, action, samplesAPI.uploadSampleFile);
    yield watchUploadChannel(channel, UPLOAD_SAMPLE_FILE, localId);
    yield samplesAPI.get({ sampleId });
}

export function* removeSample(action) {
    yield setPending(apiCall(samplesAPI.remove, action, REMOVE_SAMPLE));
    yield put(push("/samples"));
}

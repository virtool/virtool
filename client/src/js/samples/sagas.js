import { push } from "connected-react-router";
import { includes } from "lodash-es";
import { put, select, takeEvery, takeLatest, throttle } from "redux-saga/effects";
import { pushState } from "../app/actions";
import {
    CREATE_SAMPLE,
    FIND_READ_FILES,
    FIND_SAMPLES,
    GET_SAMPLE,
    REMOVE_SAMPLE,
    UPDATE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    WS_UPDATE_SAMPLE
} from "../app/actionTypes";
import * as filesAPI from "../files/api";
import { apiCall, putGenericError, setPending } from "../utils/sagas";
import * as samplesAPI from "./api";
import { getLabelsFromURL, getSampleDetailId, getTermFromURL } from "./selectors";
import { createFindURL } from "./utils";

export function* watchSamples() {
    yield takeLatest(FIND_SAMPLES.REQUESTED, findSamples);
    yield takeLatest(FIND_READ_FILES.REQUESTED, findReadFiles);
    yield takeLatest(GET_SAMPLE.REQUESTED, getSample);
    yield throttle(500, CREATE_SAMPLE.REQUESTED, createSample);
    yield takeEvery(UPDATE_SAMPLE.REQUESTED, updateSample);
    yield takeEvery(UPDATE_SAMPLE_RIGHTS.REQUESTED, updateSampleRights);
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
    let { labels, term } = action.parameters;

    if (labels === undefined) {
        labels = yield select(getLabelsFromURL);
    }

    if (term === undefined) {
        term = yield select(getTermFromURL);
    }

    const { nuvs = [], pathoscope = [], page = 1 } = action.parameters;

    const parameters = {
        labels,
        page,
        term
    };

    yield apiCall(samplesAPI.find, { parameters }, FIND_SAMPLES);

    const { pathname, search } = createFindURL(term, labels, pathoscope, nuvs);

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
    yield setPending(apiCall(samplesAPI.create, action, CREATE_SAMPLE, {}, extraFunc));
    yield put(push("/samples"));
}

export function* updateSample(action) {
    const extraFunc = { closeModal: put(pushState({ editSample: false })) };
    yield setPending(apiCall(samplesAPI.update, action, UPDATE_SAMPLE, {}, extraFunc));
}

export function* updateSampleRights(action) {
    yield setPending(apiCall(samplesAPI.updateRights, action, UPDATE_SAMPLE_RIGHTS));
}

export function* removeSample(action) {
    yield setPending(apiCall(samplesAPI.remove, action, REMOVE_SAMPLE));
    yield put(push("/samples"));
}

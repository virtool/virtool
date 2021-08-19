import { getLocation, push } from "connected-react-router";
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
    UPDATE_SEARCH,
    WS_UPDATE_SAMPLE
} from "../app/actionTypes";
import * as filesAPI from "../files/api";
import { apiCall, putGenericError } from "../utils/sagas";
import * as samplesAPI from "./api";
import { getLabelsFromURL, getSampleDetailId, getTermFromURL, getWorkflowsFromURL } from "./selectors";
import { createFindURL } from "./utils";

export function* watchSamples() {
    yield takeLatest(UPDATE_SEARCH, updateSearch);
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

export function* updateSearch(action) {
    let { labels, term } = action.parameters;

    if (labels === undefined) {
        labels = yield select(getLabelsFromURL);
    }

    if (term === undefined) {
        term = yield select(getTermFromURL);
    }

    const workflowsFromURL = yield select(getWorkflowsFromURL);

    const workflows = {
        ...workflowsFromURL,
        ...action.parameters.workflows
    };

    const { pathname, search } = createFindURL(term, labels, workflows);

    yield put(push(pathname + search));
}

export function* findSamples() {
    const routerLocation = yield select(getLocation);

    if (routerLocation.pathname === "/samples") {
        const term = yield select(getTermFromURL);
        const labels = yield select(getLabelsFromURL);

        const params = new URLSearchParams(routerLocation.search);

        yield apiCall(samplesAPI.find, { term, labels, workflows: params.get("workflows") }, FIND_SAMPLES);
    }
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
    const resp = yield apiCall(samplesAPI.create, action, CREATE_SAMPLE);

    if (resp.ok) {
        yield put(push("/samples"));
    }
}

export function* updateSample(action) {
    const resp = yield apiCall(samplesAPI.update, action, UPDATE_SAMPLE);

    if (resp.ok) {
        yield put(pushState({ editSample: false }));
    }
}

export function* updateSampleRights(action) {
    yield apiCall(samplesAPI.updateRights, action, UPDATE_SAMPLE_RIGHTS);
}

export function* removeSample(action) {
    const resp = yield apiCall(samplesAPI.remove, action, REMOVE_SAMPLE);

    if (resp.ok) {
        yield put(push("/samples"));
    }
}

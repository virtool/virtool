/**
 * Exports the rootSaga which ties together all of the sagas in the application.
 *
 * @module sagas
 */

import { push } from "connected-react-router";
import { watchAccount } from "../account/sagas";
import { watchAnalyses } from "../analyses/sagas";
import { findFiles, removeFile, upload, watchFiles } from "../files/sagas";
import { watchGroups } from "../groups/sagas";
import { watchHmms } from "../hmm/sagas";
import { watchIndexes } from "../indexes/sagas";
import { watchJobs } from "../jobs/sagas";
import { watchOTUs } from "../otus/sagas";
import { watchProcesses } from "../processes/sagas";
import { watchSamples } from "../samples/sagas";
import { watchSettings } from "../administration/sagas";
import { watchSubtraction } from "../subtraction/sagas";
import { watchUpdates } from "../updates/sagas";
import { watchUsers } from "../users/sagas";
import { watchReferences } from "../references/sagas";
import { FIND_FILES, PUSH_STATE, REMOVE_FILE, UPLOAD } from "./actionTypes";
import { all, put, select, takeEvery, takeLatest } from "redux-saga/effects";

const getLocation = state => state.router.location;

function* pushState(action) {
    const routerLocation = yield select(getLocation);
    yield put(push({ ...routerLocation, state: action.state }));
}

export function* watchRouter() {
    yield takeLatest(PUSH_STATE, pushState);
}

/**
 * Yields all of the sagas in the application. Intended for use with the ``react-saga`` middleware.
 *
 * @generator
 */
function* rootSaga() {
    yield all([
        watchAccount(),
        watchAnalyses(),
        watchFiles(),
        watchSubtraction(),
        watchHmms(),
        watchIndexes(),
        watchJobs(),
        watchOTUs(),
        watchProcesses(),
        watchRouter(),
        watchSamples(),
        watchSettings(),
        watchGroups(),
        watchUpdates(),
        watchUsers(),
        watchReferences()
    ]);
}

export default rootSaga;

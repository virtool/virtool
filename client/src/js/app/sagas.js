import { push } from "connected-react-router";
import { all, put, select, takeLatest } from "redux-saga/effects";
import { watchAccount } from "../account/sagas";
import { watchSettings } from "../administration/sagas";
import { watchAnalyses } from "../analyses/sagas";
import { watchCaches } from "../caches/sagas";
import { watchFiles } from "../files/sagas";
import { watchGroups } from "../groups/sagas";
import { watchHmms } from "../hmm/sagas";
import { watchIndexes } from "../indexes/sagas";
import { watchJobs } from "../jobs/sagas";
import { watchOTUs } from "../otus/sagas";
import { watchReferences } from "../references/sagas";
import { watchSamples } from "../samples/sagas";
import { watchLabels } from "../labels/sagas";
import { watchSubtraction } from "../subtraction/sagas";
import { watchTasks } from "../tasks/sagas";
import { watchUpdates } from "../updates/sagas";
import { watchUsers } from "../users/sagas";
import { PUSH_STATE } from "./actionTypes";

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
        watchCaches(),
        watchFiles(),
        watchSubtraction(),
        watchHmms(),
        watchIndexes(),
        watchJobs(),
        watchLabels(),
        watchOTUs(),
        watchTasks(),
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

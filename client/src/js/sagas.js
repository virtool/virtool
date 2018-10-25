/**
 * Exports the rootSaga which ties together all of the sagas in the application.
 *
 * @module sagas
 */

import { watchAccount } from "./account/sagas";
import { watchAnalyses } from "./analyses/sagas";
import { watchFiles } from "./files/sagas";
import { watchGroups } from "./groups/sagas";
import { watchHmms } from "./hmm/sagas";
import { watchIndexes } from "./indexes/sagas";
import { watchJobs } from "./jobs/sagas";
import { watchOTUs } from "./otus/sagas";
import { watchProcesses } from "./processes/sagas";
import { watchSamples } from "./samples/sagas";
import { watchSettings } from "./administration/sagas";
import { watchSubtraction } from "./subtraction/sagas";
import { watchUpdates } from "./updates/sagas";
import { watchUsers } from "./users/sagas";
import { watchReferences } from "./references/sagas";
import { all } from "redux-saga/effects";

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
        watchSamples(),
        watchSettings(),
        watchGroups(),
        watchUpdates(),
        watchUsers(),
        watchReferences()
    ]);
}

export default rootSaga;

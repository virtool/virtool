/**
 * Single entry point to start all Sagas at once.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { fork } from "redux-saga/effects"
import { watchJobs } from "./jobs/sagas";
import { watchSamples } from "./samples/sagas"
import { watchViruses } from "./viruses/sagas"
import { watchIndexes } from "./indexes/sagas"
import { watchSubtraction } from "./subtraction/sagas"
import { watchFiles } from "./files/sagas";
import { watchAccount } from "./account/sagas"
import { watchSettings } from "./settings/sagas"
import { watchUsers } from "./users/sagas";
import { watchGroups } from "./groups/sagas";
import { watchUpdates } from "./updates/sagas";

export default function* rootSaga () {
    yield [
        fork(watchJobs),
        fork(watchSamples),
        fork(watchViruses),
        fork(watchIndexes),
        fork(watchSubtraction),
        fork(watchFiles),
        fork(watchAccount),
        fork(watchSettings),
        fork(watchUsers),
        fork(watchGroups),
        fork(watchUpdates)
    ];
}

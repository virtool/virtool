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
import { watchAccount } from "./nav/sagas"
import { watchSettings, watchUpdateSettings } from "./settings/sagas"
import { watchUsers } from "./settings/users/sagas";
import { watchGroups } from "./settings/groups/sagas";

export default function* rootSaga () {
    yield [
        fork(watchJobs),
        fork(watchSamples),
        fork(watchViruses),
        fork(watchIndexes),
        fork(watchSubtraction),
        fork(watchAccount),
        fork(watchSettings),
        fork(watchUpdateSettings),
        fork(watchUsers),
        fork(watchGroups)
    ]
}

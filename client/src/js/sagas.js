/**
 * Single entry point to start all Sagas at once.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { fork } from "redux-saga/effects"
import { watchViruses } from "./viruses/sagas"
import { watchAccount, watchLogout } from "./nav/sagas"
import { watchSettings, watchUpdateSettings } from "./settings/sagas"
import { watchUsers } from "./settings/users/sagas";
import { watchGroups } from "./settings/groups/sagas";

export function* rootSaga () {
    yield [
        fork(watchViruses),
        fork(watchAccount),
        fork(watchSettings),
        fork(watchUpdateSettings),
        fork(watchUsers),
        fork(watchGroups),
        fork(watchLogout)
    ]
}

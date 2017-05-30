/**
 * Single entry point to start all Sagas at once.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { fork } from "redux-saga/effects"
import { watchViruses } from "../sagas/viruses"
import { watchAccount, watchLogout } from "../sagas/account"

export function* rootSaga () {
    yield [
        fork(watchViruses),
        fork(watchAccount),
        fork(watchLogout)
    ]
}

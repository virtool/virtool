/**
 * Single entry point to start all Sagas at once.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { all } from "redux-saga/effects"
import { watchViruses } from "./viruses";

export function* rootSaga () {
    yield all([
        watchViruses
    ])
}

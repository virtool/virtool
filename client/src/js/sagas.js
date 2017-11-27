/**
 * Single entry point to start all Sagas at once.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { watchAccount } from "./account/sagas"
import { watchFiles } from "./files/sagas";
import { watchGroups } from "./groups/sagas";
import { watchHmms } from "./hmm/sagas";
import { watchIndexes } from "./indexes/sagas"
import { watchJobs } from "./jobs/sagas";
import { watchSamples } from "./samples/sagas"
import { watchSettings } from "./settings/sagas"
import { watchSubtraction } from "./subtraction/sagas"
import { watchUpdates } from "./updates/sagas";
import { watchUsers } from "./users/sagas";
import { watchViruses } from "./viruses/sagas"

export default function* rootSaga () {
    yield [
        watchAccount(),
        watchFiles(),
        watchSubtraction(),
        watchHmms(),
        watchIndexes(),
        watchJobs(),
        watchSamples(),
        watchSettings(),
        watchGroups(),
        watchUpdates(),
        watchUsers(),
        watchViruses()
    ];
}

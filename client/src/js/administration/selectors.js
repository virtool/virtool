import { createSelector } from "reselect";
import { endsWith, flatMap, keys, map, max, pick } from "lodash-es";

import { taskDisplayNames } from "../utils";

const getMaximumTaskLimit = (limits, type) => (
    max(map(limits, (value, key) =>
        endsWith(key, type) ? value : 0
    ))
);

const taskLimitKeys = flatMap(keys(taskDisplayNames), name => [`${name}_proc`, `${name}_mem`]);

const taskSpecificLimitSelector = state => pick(state.settings.data, taskLimitKeys);

const resourcesSelector = state => state.jobs.resources;

export const maxResourcesSelector = createSelector(
    [resourcesSelector],
    resources => {
        if (resources === null) {
            return {
                maxProc: 1,
                maxMem: 1
            };
        }

        const maxProc = resources.proc.length;
        const maxMem = Math.floor(resources.mem.total / Math.pow(1024, 3));

        return { maxProc, maxMem };
    }
);

export const minResourcesSelector = createSelector(
    [taskSpecificLimitSelector],
    (limits) => ({
        minProc: getMaximumTaskLimit(limits, "proc"),
        minMem: getMaximumTaskLimit(limits, "mem")
    })
);

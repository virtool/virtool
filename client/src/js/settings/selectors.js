import { createSelector } from "reselect";
import { endsWith, flatMap, keys, map, max, pick } from "lodash-es";

import { taskDisplayNames } from "../utils";

const getMaximumTaskLimit = (limits, type) => (
    max(map(limits, (value, key) =>
        endsWith(key, type) ? value: 0
    ))
);

const taskLimitKeys = flatMap(keys(taskDisplayNames), name => [`${name}_proc`, `${name}_mem`]);

const taskSpecificLimitSelector = state => pick(state.settings.data, taskLimitKeys);

const resourcesSelector = state => state.jobs.resources;

export const maxResourcesSelector = createSelector(
    [resourcesSelector],
    resources => {
        const procLimit = resources.proc.length;
        const memLimit = parseFloat((resources.mem.total / Math.pow(1024, 3)).toFixed(1));

        return { procLimit, memLimit };
    }
);

export const minResourcesSelector = createSelector(
    [taskSpecificLimitSelector],
    (limits) => ({
        proc: getMaximumTaskLimit(limits, "proc"),
        mem: getMaximumTaskLimit(limits, "mem")
    })
);

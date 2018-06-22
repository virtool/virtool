import { createSelector } from "reselect";
import { flatMap, keys, map, minBy, pick } from "lodash-es";

import { taskDisplayNames } from "../utils";

export const readOnlyFields = ["create_subtraction", "build_index"];

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
    limits => {
        const lockFields = map(readOnlyFields, name => (
            { proc: limits[`${name}_proc`], mem: limits[`${name}_mem`] }
        ));

        const minProc = minBy(lockFields, "proc").proc;
        const minMem = minBy(lockFields, "mem").mem;

        return { minProc, minMem };
    }
);

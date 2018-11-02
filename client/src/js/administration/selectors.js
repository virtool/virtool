import { createSelector } from "reselect";
import { flatMap, keys, map, minBy, pick, pickBy, endsWith } from "lodash-es";

import { taskDisplayNames } from "../utils/utils";

export const readOnlyFields = ["create_subtraction", "build_index"];

const taskLimitKeys = flatMap(keys(taskDisplayNames), name => [`${name}_proc`, `${name}_mem`]);

const taskSpecificLimitSelector = state => pick(state.settings.data, taskLimitKeys);
const resourcesSelector = state => state.jobs.resources;

export const computeMaximums = resources => {
    if (resources === null) {
        return {
            maxProc: 1,
            maxMem: 1
        };
    }

    const maxProc = resources.proc.length;
    const maxMem = Math.floor(resources.mem.total / Math.pow(1024, 3));

    return { maxProc, maxMem };
};

export const maxResourcesSelector = createSelector([resourcesSelector], resources => computeMaximums(resources));

export const minResourcesSelector = createSelector([taskSpecificLimitSelector], limits => {
    const lockFields = map(readOnlyFields, name => ({
        proc: limits[`${name}_proc`],
        mem: limits[`${name}_mem`]
    }));

    const minProc = minBy(lockFields, "proc").proc;
    const minMem = minBy(lockFields, "mem").mem;

    return { minProc, minMem };
});

export const checkTaskUpperLimits = createSelector(
    [resourcesSelector, taskSpecificLimitSelector],
    (resources, limits) => {
        if (resources === null) {
            return null;
        }

        const { maxProc, maxMem } = computeMaximums(resources);

        const overMaxFields = pickBy(limits, (value, key) => {
            if ((endsWith(key, "proc") && maxProc < limits[key]) || (endsWith(key, "mem") && maxMem < limits[key])) {
                return true;
            }
            return false;
        });

        return overMaxFields;
    }
);

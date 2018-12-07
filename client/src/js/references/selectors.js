import { createSelector } from "reselect";
import { get, find, some } from "lodash-es";
import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.references.term;

export const getTerm = getTermSelectorFactory(getStateTerm);

export const getHasOfficial = state =>
    some(state.references.documents, ["remotes_from.slug", "virtool/ref-plant-viruses"]);

const getProcessId = state => get(state, "references.detail.process.id");

const getProcesses = state => get(state, "processes.documents", []);

export const getProgress = createSelector([getProcessId, getProcesses], (processId, processes) => {
    if (!processId || !processes.length) {
        return 0;
    }

    const process = find(processes, { id: processId });

    if (process) {
        return get(process, "progress", 0);
    }

    return 0;
});

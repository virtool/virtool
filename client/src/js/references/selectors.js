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

export const getReferenceItemProcessId = (state, index) =>
    get(state, ["references", "documents", index, "process", "id"]);

export const getReferenceItemProgress = createSelector([getReferenceItemProcessId, getProcesses], (id, processes) => {
    if (processes.length && id) {
        return find(processes, { id }).progress * 100;
    }

    return 100;
});

export const getImportData = state => {
    const file = get(state, "references.importFile");

    if (file) {
        const { id, name } = file;
        return {
            id,
            name,
            progress: 100,
            ready: true
        };
    }

    if (get(state, "references.importUploadId")) {
        return {
            name: get(state, "references.importUploadName"),
            progress: get(state, "references.importUploadProgress"),
            ready: false
        };
    }

    return null;
};

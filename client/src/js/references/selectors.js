import { find, get } from "lodash-es";
import { createSelector } from "reselect";
import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.references.term;

export const getTerm = getTermSelectorFactory(getStateTerm);

const getTaskId = state => get(state, "references.detail.task.id");

const getTasks = state => get(state, "tasks.documents", []);

export const getProgress = createSelector([getTaskId, getTasks], (taskId, tasks) => {
    if (!taskId || !tasks.length) {
        return 0;
    }

    const task = find(tasks, { id: taskId });

    if (task) {
        return get(task, "progress", 0);
    }

    return 0;
});

export const getReferenceItemTaskId = (state, index) => get(state, ["references", "documents", index, "task", "id"]);

export const getReferenceItemProgress = createSelector([getReferenceItemTaskId, getTasks], (id, tasks) => {
    if (tasks.length && id) {
        const task = find(tasks, { id });

        if (task) {
            return task.progress * 100;
        }
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

import { filter, find, get, includes, some } from "lodash-es";
import createCachedSelector from "re-reselect";
import { createSelector } from "reselect";
import { getAccount } from "../account/selectors";
import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.references.term;

export const getTerm = getTermSelectorFactory(getStateTerm);
export const getReferenceDetail = state => get(state, "references.detail");
export const getReferenceDetailId = state => get(state, "references.detail.id");
export const getDataType = state => get(state, "references.detail.data_type");

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

/**
 * Check if the logged in account has the passed `right` on the reference detail is loaded for.
 *
 * @param {object} The application state
 * @param {string} The right to check for (eg. modify_otu)
 * @returns {boolean} Whether the right is possessed the the account
 */
export const checkReferenceRight = createCachedSelector(
    [getAccount, getReferenceDetail, (state, right) => right],
    (account, detail, right) => {
        if (account.administrator) {
            return true;
        }

        if (detail === null) {
            return;
        }

        const user = find(detail.users, { id: account.id });

        if (user && user[right]) {
            return true;
        }

        // Groups user is a member of.
        const memberGroups = account.groups;

        // Groups in common between the user and the registered ref groups.
        const groups = filter(detail.groups, group => includes(memberGroups, group.id));

        if (!groups) {
            return false;
        }

        return some(groups, { [right]: true });
    }
)((state, right) => right);

/**
 * Given the application state, get a boolean indicating whether the logged in account can modify the OTUs of the
 * reference detail is loaded for.
 *
 * The result depends on the account's rights on the reference. It also depends on whether the reference is a remote
 * reference. Remote references cannot be modified by any user.
 *
 * @param {object} The application state
 * @returns {boolean} The OTU modification right of the account
 */
export const getCanModifyReferenceOTU = createSelector(
    [getReferenceDetail, state => checkReferenceRight(state, "modify_otu")],
    (detail, modifyOTU) => !detail.remotes_from && modifyOTU
);

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

import { filter, get, includes } from "lodash-es";
import { createSelector } from "reselect";
import { getTermSelectorFactory } from "../utils/selectors";

const getAdministrator = state => state.account.administrator;
const getUserId = state => state.account.id;
const getGroups = state => state.account.groups;
const getSample = state => state.samples.detail;

export const getCanModify = createSelector(
    [getAdministrator, getGroups, getSample, getUserId],
    (administrator, groups, sample, userId) => {
        if (sample) {
            return (
                administrator ||
                sample.all_write ||
                sample.user.id === userId ||
                (sample.group_write && includes(groups, sample.group))
            );
        }
    }
);

export const getCanModifyRights = createSelector(
    [getAdministrator, getUserId, getSample],
    (administrator, userId, sample) => {
        if (sample === null) {
            return;
        }

        return administrator || sample.user.id === userId;
    }
);

const getStateTerm = state => state.samples.term;

export const getTerm = getTermSelectorFactory(getStateTerm);

const getSelectedIds = state => get(state, "router.location.state.createAnalysis", []);

const getDocuments = state => state.samples.documents;

export const getSelectedDocuments = createSelector([getSelectedIds, getDocuments], (selected, documents) =>
    filter(documents, document => includes(selected, document.id))
);

import { includes } from "lodash-es";
import { createSelector } from "reselect";
import { getTermSelectorFactory } from "../utils/selectors";

const getAdministrator = state => state.account.administrator;
const getUserId = state => state.account.id;
const getGroups = state => state.account.groups;
const getSample = state => state.samples.detail;

export const getCanModify = createSelector(
    [getAdministrator, getGroups, getSample],
    (administrator, groups, sample) => {
        if (sample) {
            return administrator || sample.all_write || (sample.group_write && includes(groups, sample.group));
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

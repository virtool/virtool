import { createSelector } from "reselect";

const getAccount = state => state.account;
const getCurrentSample = state => state.samples.detail;

export const getCanModify = createSelector(
    [getAccount, getCurrentSample],
    (account, sample) => {
        if (sample === null) {
            return;
        }

        return (
            sample.all_write ||
            account.groups.includes("administrator") ||
            sample.group_write && account.groups.includes(sample.group)
        );
    }
);

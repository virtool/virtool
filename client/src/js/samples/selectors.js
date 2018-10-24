import { includes } from "lodash-es";
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
      account.administrator ||
      (sample.group_write && includes(account.groups, sample.group))
    );
  }
);

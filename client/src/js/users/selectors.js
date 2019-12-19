import { get } from "lodash-es";
import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.users.term;

export const getTerm = getTermSelectorFactory(getStateTerm);

export const getActiveUserId = state => get(state, "account.id");
export const getActiveUserAdministrator = state => get(state, "account.administrator");
export const getUserDetailId = state => get(state, "users.detail.id");

export const getCanModifyUser = state => {
    const activeUserId = getActiveUserId(state);
    return activeUserId && getActiveUserAdministrator(state) && activeUserId !== getUserDetailId(state);
};

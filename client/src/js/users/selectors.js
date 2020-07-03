import { get } from "lodash-es";
import { getAccountAdministrator, getAccountId } from "../account/selectors";
import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.users.term;

export const getTerm = getTermSelectorFactory(getStateTerm);

export const getUserDetailId = state => get(state, "users.detail.id");

export const getCanModifyUser = state => {
    const activeUserId = getAccountId(state);
    return activeUserId && getAccountAdministrator(state) && activeUserId !== getUserDetailId(state);
};

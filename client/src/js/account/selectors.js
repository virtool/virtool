import { get } from "lodash-es";

export const getAccount = state => state.account;
export const getAccountAdministrator = state => get(state, "account.administrator", false);
export const getAccountId = state => state.account.id;

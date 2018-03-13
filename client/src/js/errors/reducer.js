import { endsWith, replace } from "lodash-es";
import { reportAPIError } from "../utils";
import {
    CREATE_SAMPLE,
    UPDATE_SAMPLE,
    CREATE_VIRUS,
    EDIT_VIRUS,
    ADD_ISOLATE,
    EDIT_ISOLATE,
    ADD_SEQUENCE,
    EDIT_SEQUENCE,
    CREATE_INDEX,
    CREATE_SUBTRACTION,
    UPDATE_ACCOUNT,
    CHANGE_ACCOUNT_PASSWORD,
    CREATE_USER,
    EDIT_USER,
    CREATE_GROUP
} from "../actionTypes";

const checkActionFailed = (action) => {
    const isFailed = endsWith(action.type, "_FAILED");
    return isFailed ? action : false;
};

const getErrorName = (action) => {
    const errorName = replace(action.type, "_FAILED", "_ERROR");
    return errorName;
};

const resetErrorName = (successAction) => {
    const errorName = endsWith(successAction.type, "_SUCCEEDED")
        ? replace(successAction.type, "_SUCCEEDED", "_ERROR")
        : null;

    return errorName;
};

export default function errorsReducer (state = null, action) {

    const failedAction = checkActionFailed(action);
    let errorName;

    if (failedAction) {
        errorName = getErrorName(action);
    } else {
        errorName = state ? resetErrorName(action) : null;
        if (errorName && state[errorName]) {
            return {...state, [errorName]: null};
        }
        return state;
    }

    const errorPayload = { status: failedAction.status, message: failedAction.message };

    switch (failedAction.type) {

        case CREATE_SAMPLE.FAILED:
        case UPDATE_SAMPLE.FAILED:
        case CREATE_VIRUS.FAILED:
        case EDIT_VIRUS.FAILED:
        case ADD_ISOLATE.FAILED:
        case EDIT_ISOLATE.FAILED:
        case ADD_SEQUENCE.FAILED:
        case EDIT_SEQUENCE.FAILED:
        case CREATE_INDEX.FAILED:
        case CREATE_SUBTRACTION.FAILED:
        case UPDATE_ACCOUNT.FAILED:
        case CHANGE_ACCOUNT_PASSWORD.FAILED:
        case CREATE_USER.FAILED:
        case EDIT_USER.FAILED:
        case CREATE_GROUP.FAILED:
            return {...state, [errorName]: errorPayload};

        default:
            reportAPIError(failedAction);
            return state;
    }
}

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
    const actionType = action.type;
    const isFailed = endsWith(actionType, "_FAILED");

    if (isFailed) {
        return action;
    }
    return false;
};

const getErrorName = (action) => {
    const actionType = action.type;
    const errorName = replace(actionType, "_FAILED", "_ERROR");

    return errorName;
};

const resetError = (successAction) => {
    const actionType = successAction.type;
    const errorName = endsWith(actionType, "_SUCCEEDED")
        ? replace(actionType, "_SUCCEEDED", "_ERROR")
        : null;

    return errorName;
};

export default function errorsReducer (state = null, action) {

    const failedAction = checkActionFailed(action);
    let errorName;

    if (failedAction) {
        errorName = getErrorName(action);
    } else {
        errorName = state ? resetError(action) : null;
        if (errorName && state[errorName]) {
            return {...state, [errorName]: null};
        } else {
            return state;
        }
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
            return {...state, UNHANDLED_ERROR: errorPayload};
    }
}

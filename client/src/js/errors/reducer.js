import { endsWith } from "lodash-es";
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

const initialState = {
    errors: null
};

const checkActionFailed = (action) => {
    const actionType = action.type;
    const isFailed = endsWith(actionType, "_FAILED");

    if (isFailed) {
        return action;
    }
    return false;
};

export default function errorsReducer (state = initialState, action) {

    const failedAction = checkActionFailed(action);

    if (!failedAction) {
        return {...state, errors: null};
    }

    console.log(action, failedAction);

    const errorPayload = { status: failedAction.status, message: failedAction.message };

    switch (failedAction.type) {

        case CREATE_SAMPLE.FAILED:
            return {...state, errors: {createSampleError: errorPayload}};

        case UPDATE_SAMPLE.FAILED:
            return {...state, errors: {updateSampleError: errorPayload}};

        case CREATE_VIRUS.FAILED:
            return {...state, errors: {createVirusError: errorPayload}};

        case EDIT_VIRUS.FAILED:
            return {...state, errors: {editVirusError: errorPayload}};

        case ADD_ISOLATE.FAILED:
            return {...state, errors: {addIsolateError: errorPayload}};

        case EDIT_ISOLATE.FAILED:
            return {...state, errors: {editIsolateError: errorPayload}};

        case ADD_SEQUENCE.FAILED:
            return {...state, errors: {addSequenceError: errorPayload}};

        case EDIT_SEQUENCE.FAILED:
            return {...state, errors: {editSequenceError: errorPayload}};

        case CREATE_INDEX.FAILED:
            return {...state, errors: {createIndexError: errorPayload}};

        case CREATE_SUBTRACTION.FAILED:
            return {...state, errors: {createSubtractionError: errorPayload}};

        case UPDATE_ACCOUNT.FAILED:
            return {...state, errors: {updateAccountError: errorPayload}};

        case CHANGE_ACCOUNT_PASSWORD.FAILED:
            return {...state, errors: {changePasswordError: errorPayload}};

        case CREATE_USER.FAILED:
            return {...state, errors: {createUserError: errorPayload}};

        case EDIT_USER.FAILED:
            return {...state, errors: {editUserError: errorPayload}};

        case CREATE_GROUP.FAILED:
            return {...state, errors: {createGroupError: errorPayload}};

        default:
            reportAPIError(failedAction);
            return state;
    }
}

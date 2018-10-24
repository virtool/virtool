/**
 * Exports a reducer for dealing with various request errors.
 *
 * @module errors/reducer
 */
import { endsWith, replace } from "lodash-es";
import { reportAPIError } from "../utils";
import {
  CLEAR_ERROR,
  CREATE_SAMPLE,
  UPDATE_SAMPLE,
  CREATE_OTU,
  EDIT_OTU,
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
  CREATE_GROUP,
  GET_JOB,
  GET_SAMPLE,
  GET_ANALYSIS,
  GET_REFERENCE,
  GET_OTU,
  GET_HMM,
  GET_INDEX,
  GET_SUBTRACTION,
  GET_RESOURCES,
  UPDATE_SETTINGS,
  LIST_USERS,
  GET_USER
} from "../actionTypes";

/**
 * Checks whether supplied action is of failed action type,
 * and returns the action if it is, otherwise returns false.
 *
 * @func
 * @param action {object}
 * @returns {(object|boolean)}
 */
export const checkActionFailed = action => {
  const isFailed = endsWith(action.type, "_FAILED");
  return isFailed ? action : false;
};

/**
 * Returns the error field name from the failed action type.
 *
 * @func
 * @param action {object}
 * @returns {object}
 */
export const getErrorName = action => replace(action.type, "_FAILED", "_ERROR");

/**
 * Clears error if a new request is made for the same category.
 *
 * @func
 * @param state {object}
 * @returns {object}
 */
export const resetErrorName = action => {
  if (endsWith(action.type, "_REQUESTED")) {
    return replace(action.type, "_REQUESTED", "_ERROR");
  }
};

/**
 * A reducer for dealing with various request errors.
 *
 * @param state {object}
 * @param action {object}
 * @returns {object}
 */
export default function errorsReducer(state = null, action) {
  if (action.type === CLEAR_ERROR) {
    // Clear specific error explicitly
    return { ...state, [action.error]: null };
  }

  const failedAction = checkActionFailed(action);

  if (failedAction) {
    const errorName = getErrorName(action);

    const errorPayload = {
      status: failedAction.status,
      message: failedAction.message
    };

    switch (failedAction.type) {
      case CREATE_SAMPLE.FAILED:
      case UPDATE_SAMPLE.FAILED:
      case CREATE_OTU.FAILED:
      case EDIT_OTU.FAILED:
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
      case GET_JOB.FAILED:
      case GET_RESOURCES.FAILED:
      case GET_SAMPLE.FAILED:
      case GET_ANALYSIS.FAILED:
      case GET_REFERENCE.FAILED:
      case GET_OTU.FAILED:
      case GET_HMM.FAILED:
      case GET_INDEX.FAILED:
      case GET_SUBTRACTION.FAILED:
      case UPDATE_SETTINGS.FAILED:
      case LIST_USERS.FAILED:
      case GET_USER.FAILED:
        return { ...state, [errorName]: errorPayload };

      default:
        // Report uncaught errors to Sentry
        reportAPIError(failedAction);
        return state;
    }
  }

  // Ignore requests until an error has occurred
  const errorName = state ? resetErrorName(action) : null;

  // Only clear errors on request that had been set previously
  if (errorName && state[errorName]) {
    return { ...state, [errorName]: null };
  }
  return state;
}

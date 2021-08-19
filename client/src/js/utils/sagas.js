/**
 * Utility functions for working with sagas.
 *
 * @module sagaUtils
 */
import { replace } from "connected-react-router";
import { get, includes } from "lodash-es";
import { put } from "redux-saga/effects";
import { LOGOUT } from "../app/actionTypes";
import { createFindURL } from "./utils";

/**
 * Executes an API call by calling ``apiMethod`` with ``action``.
 *
 * If the call succeeds an action with ``actionType.SUCCEEDED`` and a ``data`` property is dispatched.
 *
 * If the call fails an action with ``actionType.FAILED`` and generic error properties is dispatched.
 *
 * @generator
 * @param apiMethod {function} the function to call with ``action``
 * @param action {object} an action to pass to ``apiMethod``
 * @param actionType {object} a request-style action type
 * @param context {object} data to assign to the `context` property of the action
 */
export function* apiCall(apiMethod, action, actionType, context = {}) {
    try {
        const response = yield apiMethod(action);
        yield put({ type: actionType.SUCCEEDED, data: response.body, context });
        return response;
    } catch (error) {
        const statusCode = get(error, "response.statusCode");

        if (statusCode === 401) {
            yield put({
                type: LOGOUT.SUCCEEDED
            });
            return error.response;
        }

        if (get(error, "response.body")) {
            yield putGenericError(actionType, error);
            return error.response;
        }

        throw error;
    }
}

export function* pushFindTerm(term, contains) {
    const url = createFindURL(term);

    if (!contains || includes(url.pathname, contains)) {
        yield put(replace(url.pathname + url.search));
    }
}

/**
 * Should be called in the event of an HTTP error during an API call. Dispatches a ``FAILED`` request-style action
 * containing data related to the HTTP error.
 *
 * @generator
 * @param actionType {object} a request-style action type
 * @param error {object} the HTTP error from Superagent
 */
export function* putGenericError(actionType, error) {
    const { body, status } = error.response;

    yield put({
        type: actionType.FAILED,
        message: body.message,
        error,
        status
    });
}

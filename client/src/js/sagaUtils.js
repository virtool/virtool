/**
 * Utility functions for working with sagas.
 *
 * @module sagaUtils
 */
import { push } from "react-router-redux";
import { matchPath } from "react-router-dom";
import { SET_APP_PENDING, UNSET_APP_PENDING } from "./actionTypes";
import { put, all } from "redux-saga/effects";

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
 * @param extra {object} extra properties to assign to the SUCCEEDED action
 */
export function* apiCall(apiMethod, action, actionType, extra = {}, extraFunctions) {
    try {
        const response = yield apiMethod(action);
        yield put({ type: actionType.SUCCEEDED, data: response.body, ...extra });
        yield all(extraFunctions);
    } catch (error) {
        yield putGenericError(actionType, error);
    }
}

/**
 * Executes an API call that uses Virtool's find implementation when the browser URL matches to ``path``.
 *
 * This generator is intended to be used in a saga triggered by ``LOCATION_CHANGE`` from ``react-router-redux``. If the
 * ``path`` matches the current browser URL and API request will be sent to the server with the search parameter
 * (if any) appended to the request URL.
 *
 * The actual API call is made using {@link apiCall}.
 *
 * @generator
 * @param path {string} the path that, when matched, will allow find calls
 * @param apiMethod {function} the API function to call
 * @param action {object} the action to pass to the ``apiMethod``
 * @param actionType {object} the request-style action type to dispatch when the call completes
 */
export function* apiFind(path, apiMethod, action, actionType) {
    const { pathname } = action.payload;

    const match = matchPath(pathname, { path, exact: true });

    if (match) {
        yield apiCall(apiMethod, {}, actionType);
    }
}

/**
 * Pushes new user-defined state to history.
 *
 * @generator
 * @param update {object} a new state object
 */
export function* pushHistoryState(update) {
    yield put(push({ ...window.location, state: update }));
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

/**
 * Dispatches actions while yielding the passed ``generator`` that result in a GitHub-style loading bar progressing
 * across the page just below the navigation bar.
 *
 * @generator
 * @param generator {generator} the generator to yield while the bar is progressing *
 */
export function* setPending(generator) {
    yield put({ type: SET_APP_PENDING });
    yield generator;
    yield put({ type: UNSET_APP_PENDING });
}

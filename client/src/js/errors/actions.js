/**
 * Redux action creator for clearing errors.
 *
 * @module error/actions
 */
import { CLEAR_ERROR } from "../actionTypes";

/**
 * Returns action that clears specific error in the store.
 *
 * @func
 * @returns {object}
 */
export const clearError = error => ({
    type: CLEAR_ERROR,
    error
});

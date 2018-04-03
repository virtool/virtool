/**
 * Redux action creator for clearing errors.
 *
 * @module error/actions
 */
import { CLEAR_ERROR } from "../actionTypes";

/**
 * Clears specific temprorarily stored error.
 *
 * @func
 * @returns {object}
 */
export const clearError = (error) => ({
    type: CLEAR_ERROR,
    error
});

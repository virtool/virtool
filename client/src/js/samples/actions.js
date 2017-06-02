/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { FIND_SAMPLES } from "../actionTypes";

export const findSamples = (term) => {
    return {
        type: FIND_SAMPLES.REQUESTED,
        term: term
    };
};

/**
 * Redux reducers for working with job data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign, concat, find, reject } from "lodash";
import {
    WS_UPDATE_JOB,
    WS_REMOVE_JOB,
    FIND_JOBS,
    GET_JOB
} from "../actionTypes";

const initialState = {
    list: null,
    detail: null
};

export default function reducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_JOB:
            return assign({}, state, {
                viruses: concat(
                    reject(state.viruses, {virus_id: action.virus_id}),
                    assign({}, find(state.viruses, {virus_id: action.virus_id}), action.data)
                )
            });

        case WS_REMOVE_JOB:
            return assign({}, state, {
                viruses: reject(state.viruses, {virus_id: action.virus_id})
            });

        case FIND_JOBS.SUCCEEDED:
            return assign({}, state, {
                list: action.data
            });

        case GET_JOB.REQUESTED:
            return assign({}, state, {
                detail: null
            });

        case GET_JOB.SUCCEEDED:
            return assign({}, state, {
                detail: action.data
            });

        default:
            return state;
    }
}

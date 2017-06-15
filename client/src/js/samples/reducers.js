/**
 * Redux reducers for working with virus data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign, concat, find, reject } from "lodash";
import {
    WS_UPDATE_SAMPLE,
    WS_REMOVE_SAMPLE,
    FIND_SAMPLES,
    GET_SAMPLE,
    FIND_ANALYSES,
    ANALYZE
} from "../actionTypes";

const initialState = {
    list: null,
    detail: null,
    analyses: null
};

export default function reducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_SAMPLE:
            return assign({}, state, {
                viruses: concat(
                    reject(state.viruses, {virus_id: action.virus_id}),
                    assign({}, find(state.viruses, {virus_id: action.virus_id}), action.data)
                )
            });

        case WS_REMOVE_SAMPLE:
            return assign({}, state, {
                viruses: reject(state.viruses, {virus_id: action.virus_id})
            });

        case FIND_SAMPLES.SUCCEEDED:
            return assign({}, state, {
                list: action.data
            });

        case GET_SAMPLE.REQUESTED:
            return assign({}, state, {
                detail: null
            });

        case GET_SAMPLE.SUCCEEDED:
            return assign({}, state, {
                detail: action.data
            });

        case FIND_ANALYSES.REQUESTED:
            return assign({}, state, {
                analyses: null
            });

        case FIND_ANALYSES.SUCCEEDED:
            return assign({}, state, {
                analyses: action.data
            });

        case ANALYZE.SUCCEEDED:
            return assign({}, state, {
                analyses: state.analyses.concat([action.data])
            });

        default:
            return state;
    }
}

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
    WS_REMOVE_ANALYSIS,
    FIND_SAMPLES,
    GET_SAMPLE,
    UPDATE_SAMPLE,
    REMOVE_SAMPLE,
    SHOW_EDIT_SAMPLE,
    SHOW_REMOVE_SAMPLE,
    HIDE_SAMPLE_MODAL,
    FIND_ANALYSES,
    FIND_READY_HOSTS,
    GET_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,
    REMOVE_ANALYSIS
} from "../actionTypes";

const setNuvsBLAST = (state, analysisId, sequenceIndex, data = "ip") => {
    const analysisDetail = state.analysisDetail;

    if (analysisDetail.id === analysisId) {
        return assign({}, state, {
            analysisDetail: assign({}, analysisDetail, {
                results: analysisDetail.results.map(sequence => {
                    if (sequenceIndex === sequenceIndex) {
                        return assign({}, sequence, {blast: data});
                    }

                    return sequence;
                })
            })
        });
    }

    return state;
};

const initialState = {
    documents: null,
    detail: null,

    analyses: null,
    analysisDetail: null,

    showEdit: false,
    showRemove: false,

    readyHosts: null
};

export default function reducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_SAMPLE:
            return assign({}, state, {
                viruses: concat(
                    reject(state.viruses, {id: action.virus_id}),
                    assign({}, find(state.viruses, {id: action.virus_id}), action.data)
                )
            });

        case WS_REMOVE_SAMPLE:
            return assign({}, state, {
                viruses: reject(state.viruses, {id: action.virus_id})
            });

        case WS_REMOVE_ANALYSIS:
            console.log(action);
            return state;

        case FIND_SAMPLES.SUCCEEDED:
            return assign({}, state, {
                documents: action.data.documents,
                totalCount: action.data.total_count,
                foundCount: action.data.found_count,
                pageCount: action.data.page_count,
                page: action.data.page
            });

        case FIND_READY_HOSTS.SUCCEEDED:
            return assign({}, state, {
                readyHosts: action.data.documents
            });

        case GET_SAMPLE.REQUESTED:
            return assign({}, state, {
                detail: null,
                analyses: null,
                analysisDetail: null
            });

        case GET_SAMPLE.SUCCEEDED:
            return assign({}, state, {
                detail: action.data
            });

        case UPDATE_SAMPLE.SUCCEEDED: {
            let newState = {};

            if (state.list !== null) {
                assign(newState, state, {
                    list: state.list.map(doc => {
                        if (doc.id !== action.data.sample_id) {
                            return doc;
                        }

                        return assign({}, doc, action.data);
                    })
                });
            }

            if (state.detail && state.detail.id === action.data.sample_id) {
                assign(newState, {
                    detail: assign({}, state.detail, action.data)
                });
            }

            return newState;
        }

        case REMOVE_SAMPLE.SUCCEEDED:
            return assign({}, state, {
                analyses: reject(state.analyses, {id: action.id}),
                analysisDetail: state.analysisDetail.id === action.id ? null: state.analysisDetail
            });

        case SHOW_EDIT_SAMPLE:
            return assign({}, state, {
                showEdit: true,
                showRemove: false
            });

        case SHOW_REMOVE_SAMPLE:
            return assign({}, state, {
                showEdit: false,
                showRemove: true
            });

        case HIDE_SAMPLE_MODAL:
            return assign({}, state, {
                showEdit: false,
                showRemove: false
            });

        case FIND_ANALYSES.REQUESTED:
            return assign({}, state, {
                analyses: null,
                analysisDetail: null
            });

        case FIND_ANALYSES.SUCCEEDED:
            return assign({}, state, {
                analyses: action.data.documents
            });

        case GET_ANALYSIS.REQUESTED:
            return assign({}, state, {
                analysisDetail: null
            });

        case GET_ANALYSIS.SUCCEEDED:
            return assign({}, state, {
                analysisDetail: action.data
            });

        case ANALYZE.SUCCEEDED:
            return assign({}, state, {
                analyses: state.analyses.concat([action.data])
            });

        case BLAST_NUVS.REQUESTED:
            return setNuvsBLAST(state, action.analysisId, action.sequenceIndex, {ready: false});

        case BLAST_NUVS.SUCCEEDED:
            return setNuvsBLAST(state, action.analysisId, action.sequenceIndex, action.data);

        case REMOVE_ANALYSIS.SUCCEEDED:
            if (state.analyses === null) {
                return state;
            }

            return assign({}, state, {analyses: reject(state.analyses, {id: action.id})});

        default:
            return state;
    }
}

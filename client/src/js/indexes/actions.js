import { simpleActionCreator } from "../utils";
import { FIND_INDEXES, GET_INDEX, GET_UNBUILT, CREATE_INDEX, GET_INDEX_HISTORY } from "../actionTypes";

export const findIndexes = simpleActionCreator(FIND_INDEXES.REQUESTED);

export const getIndex = (indexVersion) => ({
    type: GET_INDEX.REQUESTED,
    indexVersion
});

export const getUnbuilt = simpleActionCreator(GET_UNBUILT.REQUESTED);

export const createIndex = simpleActionCreator(CREATE_INDEX.REQUESTED);

export const getIndexHistory = (indexVersion) => ({
    type: GET_INDEX_HISTORY.REQUESTED,
    indexVersion
});

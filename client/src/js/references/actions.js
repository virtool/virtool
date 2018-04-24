import { simpleActionCreator } from "../utils";
import {
    LIST_REFS,
    GET_REF,
} from "../actionTypes";

export const listRefs = simpleActionCreator(LIST_REFS);

export const getRef = (refId) => ({
    type: GET_REF.REQUESTED,
    refId
});

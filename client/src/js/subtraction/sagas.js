import { push } from "react-router-redux";

import { apiCall, pushHistoryState, setPending } from "../sagaUtils";
import {
  LIST_SUBTRACTIONS,
  FILTER_SUBTRACTIONS,
  GET_SUBTRACTION,
  CREATE_SUBTRACTION,
  UPDATE_SUBTRACTION,
  REMOVE_SUBTRACTION
} from "../actionTypes";
import * as subtractionAPI from "./api";
import { put, takeLatest, throttle, call } from "redux-saga/effects";

export function* listSubtractions(action) {
  yield apiCall(subtractionAPI.list, action, LIST_SUBTRACTIONS);
}

export function* filterSubtractions(action) {
  yield apiCall(subtractionAPI.filter, action, FILTER_SUBTRACTIONS);
}

export function* getSubtraction(action) {
  yield apiCall(subtractionAPI.get, action, GET_SUBTRACTION);
}

export function* createSubtraction(action) {
  const extraFunc = {
    closeModal: call(pushHistoryState, { createSubtraction: false })
  };
  yield setPending(
    apiCall(subtractionAPI.create, action, CREATE_SUBTRACTION, {}, extraFunc)
  );
}

export function* updateSubtraction(action) {
  yield setPending(apiCall(subtractionAPI.update, action, UPDATE_SUBTRACTION));
}

export function* removeSubtraction(action) {
  const extraFunc = {
    goBack: put(push("/subtraction"))
  };
  yield apiCall(
    subtractionAPI.remove,
    action,
    REMOVE_SUBTRACTION,
    {},
    extraFunc
  );
}

export function* watchSubtraction() {
  yield takeLatest(LIST_SUBTRACTIONS.REQUESTED, listSubtractions);
  yield takeLatest(FILTER_SUBTRACTIONS.REQUESTED, filterSubtractions);
  yield takeLatest(GET_SUBTRACTION.REQUESTED, getSubtraction);
  yield throttle(500, CREATE_SUBTRACTION.REQUESTED, createSubtraction);
  yield takeLatest(UPDATE_SUBTRACTION.REQUESTED, updateSubtraction);
  yield throttle(300, REMOVE_SUBTRACTION.REQUESTED, removeSubtraction);
}

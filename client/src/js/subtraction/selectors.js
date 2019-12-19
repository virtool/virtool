import { get } from "lodash-es";

export const getSubtractionIds = state => get(state, "subtraction.ids");

export const getFirstSubtractionId = state => get(state, ["subtraction", "ids", 0]);

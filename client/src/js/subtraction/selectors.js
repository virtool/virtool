import { get } from "lodash-es";

export const getSubtractionShortlist = state => get(state, "subtraction.shortlist");

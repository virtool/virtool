import { get } from "lodash-es";
import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.jobs.term;

export const getTerm = getTermSelectorFactory(getStateTerm);
export const getJobDetailId = state => get(state, "jobs.detail.id");
export const getLinkedJobs = state => state.jobs.linkedJobs;

import { find, get } from "lodash-es";
import { getTermSelectorFactory } from "../utils/selectors";

export const getStateTerm = state => state.hmms.term;

export const getTerm = getTermSelectorFactory(getStateTerm);

export const getProcess = state => {
    const processes = state.processes.documents;
    const processId = get(state.hmms.status, "process.id");
    if (processId && processes.length) {
        const process = find(processes, { id: processId });
        return process || undefined;
    }
};

import {
    WS_UPDATE_PROCESS,
    LIST_PROCESSES,
    GET_PROCESS
} from "../actionTypes";

export const wsUpdateProcess = (data) => ({
    type: WS_UPDATE_PROCESS,
    data
});

export const listProcesses = () => ({
    type: LIST_PROCESSES
});

export const getProcess = (processId) => ({
    type: GET_PROCESS,
    processId
});

import { simpleActionCreator } from "../utils/utils";
import { WS_INSERT_PROCESS, WS_UPDATE_PROCESS, LIST_PROCESSES, GET_PROCESS } from "../app/actionTypes";

export const wsInsertProcess = data => ({
    type: WS_INSERT_PROCESS,
    data
});

export const wsUpdateProcess = data => ({
    type: WS_UPDATE_PROCESS,
    data
});

export const listProcesses = simpleActionCreator(LIST_PROCESSES.REQUESTED);

export const getProcess = processId => ({
    type: GET_PROCESS,
    processId
});

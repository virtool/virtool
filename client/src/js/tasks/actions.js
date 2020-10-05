import { GET_TASK, LIST_TASKS, WS_INSERT_TASK, WS_UPDATE_TASK } from "../app/actionTypes";
import { simpleActionCreator } from "../utils/utils";

export const wsInsertTask = data => ({
    type: WS_INSERT_TASK,
    data
});

export const wsUpdateTask = data => ({
    type: WS_UPDATE_TASK,
    data
});

export const listTasks = simpleActionCreator(LIST_TASKS.REQUESTED);

export const getTask = taskId => ({
    type: GET_TASK,
    taskId
});

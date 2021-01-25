import { POST_DEV_COMMAND } from "../app/actionTypes";

export const postDevCommand = command => ({ type: POST_DEV_COMMAND.REQUESTED, command });

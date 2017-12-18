import { WS_UPDATE_STATUS } from "../actionTypes";

export const wsUpdateStatus = (data) => ({
    type: WS_UPDATE_STATUS,
    data
});

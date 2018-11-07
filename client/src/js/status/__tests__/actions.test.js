import { WS_UPDATE_STATUS } from "../../app/actionTypes";
import { wsUpdateStatus } from "../actions";

describe("Status Action Creators:", () => {
    it("should create an action to update status", () => {
        const data = { data: { id: "testing" } };
        const result = wsUpdateStatus(data);
        const expected = {
            type: WS_UPDATE_STATUS,
            data
        };

        expect(result).toEqual(expected);
    });
});

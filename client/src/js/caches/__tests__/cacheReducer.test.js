import { GET_CACHE } from "../../app/actionTypes";
import cacheReducer from "../reducer";

describe("<cacheReducer />", () => {
    let state;

    beforeEach(() => {
        state: {
            detial: null;
        }
    });
    it("should return ", () => {
        const action = {
            type: "UNHANDLED"
        };
        const result = cacheReducer(state, action);
        expect(result).toEqual({ ...state, detail: null });
    });
    it("should return detail null", () => {
        const action = {
            type: GET_CACHE.REQUESTED
        };
        const result = cacheReducer(state, action);
        expect(result).toEqual({ ...state, detail: null });
    });
    it("should return detail action.data", () => {
        const action = {
            type: GET_CACHE.SUCCEEDED,
            data: "foo"
        };
        const result = cacheReducer(state, action);
        expect(result).toEqual({ ...state, detail: "foo" });
    });
});

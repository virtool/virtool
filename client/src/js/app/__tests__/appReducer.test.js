import { CREATE_FIRST_USER, LOGIN, LOGOUT, RESET_PASSWORD } from "../actionTypes";
import { appReducer } from "../reducer";

describe("App Reducer", () => {
    let state;

    beforeEach(() => {
        state = {
            dev: "foo",
            first: "bar",
            login: true,
            reset: false,
            resetCode: true
        };
    });

    it("should return existing state for unhandled action", () => {
        const action = {
            type: "UNHANDLED"
        };
        const result = appReducer(state, action);
        expect(result).toEqual(state);
    });

    it.each([
        [
            { type: LOGIN.SUCCEEDED, data: { reset: true, reset_code: false } },
            { dev: "foo", first: "bar", login: false, reset: true, resetCode: false }
        ],
        [{ type: LOGIN.FAILED }, { dev: "foo", first: "bar", reset: false, resetCode: true, login: true }]
    ])(".match(%o, %o)", (action, expected) => {
        const result = appReducer(state, action);
        expect(result).toEqual(expected);
    });

    it("should return login false, reset true, resetCode false", () => {
        state.login = false;
        const action = {
            type: LOGOUT.SUCCEEDED
        };
        const result = appReducer(state, action);
        expect(result).toEqual({
            ...state,
            login: true
        });
    });

    it.each([
        [
            RESET_PASSWORD.SUCCEEDED,
            {
                dev: "foo",
                first: "bar",
                login: false,
                reset: false,
                resetCode: null,
                resetError: null
            }
        ],
        [
            RESET_PASSWORD.FAILED,
            {
                dev: "foo",
                first: "bar",
                login: false,
                reset: true,
                resetCode: true,
                resetError: true
            }
        ]
    ])(".match(%o, %o)", (type, expected) => {
        const action = {
            type,
            resetCode: false,
            resetError: false,
            data: { reset_code: true, error: true }
        };
        const result = appReducer(state, action);

        expect(result).toEqual(expected);
    });

    it("should render", () => {
        state.login = true;
        state.first = true;
        const action = {
            type: CREATE_FIRST_USER.SUCCEEDED
        };
        const result = appReducer(state, action);
        expect(result).toEqual({
            ...state,
            login: false,
            first: false
        });
    });
});

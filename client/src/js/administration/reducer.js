import { GET_SETTINGS, UPDATE_SETTINGS } from "../app/actionTypes";

export const initialState = {
    data: null
};

export default function settingsReducer(state = initialState, action) {
    switch (action.type) {
        case GET_SETTINGS.SUCCEEDED:
            return { ...state, data: action.data };

        case UPDATE_SETTINGS.SUCCEEDED:
            return {
                ...state,
                data: { ...state.data, ...action.update }
            };

        default:
            return state;
    }
}

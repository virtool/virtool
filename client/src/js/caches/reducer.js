import { GET_CACHE } from "../app/actionTypes";

const initialState = {
    detail: null
};

export default function cacheReducer(state = initialState, action) {
    switch (action.type) {
        case GET_CACHE.REQUESTED:
            return { ...state, detail: null };

        case GET_CACHE.SUCCEEDED:
            return {
                ...state,
                detail: action.data
            };

        default:
            return state;
    }
}

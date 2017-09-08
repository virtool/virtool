import { assign } from "lodash";
import { GET_SOFTWARE_UPDATES, GET_DATABASE_UPDATES } from "../actionTypes";

const initialState = {
    software: null,
    database: null
};

const updatesReducer = (state = initialState, action) => {

    switch (action.type) {

        case GET_SOFTWARE_UPDATES.SUCCEEDED:
            return assign({}, state, {software: action.data});

        case GET_DATABASE_UPDATES.SUCCEEDED:
            return assign({}, state, {database: action.data});

        default:
            return state;
    }

};

export default updatesReducer;

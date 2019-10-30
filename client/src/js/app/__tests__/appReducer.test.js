import { appReducer } from "../reducer";
import { CREATE_FIRST_USER, LOGIN, LOGOUT, RESET_PASSWORD, SET_APP_PENDING, UNSET_APP_PENDING } from "../actionTypes";

describe("<appReducer />", () => {
    let props;

    const actionType = [
        "SET_APP_PENDING",
        "UNSET_APP_PENDING",
        LOGIN.SUCCEEDED,
        LOGIN.FAILED,
        LOGOUT.SUCCEEDED,
        RESET_PASSWORD.SUCCEEDED,
        RESET_PASSWORD.FAILED,
        CREATE_FIRST_USER.SUCCEEDED
    ];
    it.each(actionType)("should render", () => {
        const wrapper = shallow(<appReducer {...props} />);
        expect(wrapper).toMatchSnapshot;
    });
});

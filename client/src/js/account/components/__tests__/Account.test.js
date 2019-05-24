import { GET_ACCOUNT } from "../../../app/actionTypes";
import { Account, mapStateToProps, mapDispatchToProps } from "../Account";

describe("<Account />", () => {
    it("should render", () => {
        const props = {
            userId: "bob",
            onGet: jest.fn()
        };
        const wrapper = shallow(<Account {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    it("should return state props", () => {
        const state = {
            account: {
                id: "bob"
            }
        };

        const result = mapStateToProps(state);

        expect(result).toEqual({
            userId: "bob"
        });
    });
});

describe("mapDispatchToProps", () => {
    it("should return dispatch functions", () => {
        const dispatch = jest.fn();
        const result = mapDispatchToProps(dispatch);

        result.onGet();

        expect(dispatch).toHaveBeenCalledWith({
            type: GET_ACCOUNT.REQUESTED
        });
    });
});

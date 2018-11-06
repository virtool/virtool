import { Password } from "../Password";

describe("<Password />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            detail: {
                id: "test-user",
                force_reset: false,
                last_password_change: "2018-02-14T17:12:00.000000Z"
            },
            minPassLen: 8,
            onSetForceReset: jest.fn()
        };
        wrapper = shallow(<Password {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

import { Password } from "../Password";

describe("<Password />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            id: "bob",
            forceReset: false,
            lastPasswordChange: "2018-02-14T17:12:00.000000Z",
            minimumPasswordLength: 8,
            onSetForceReset: jest.fn()
        };
        wrapper = shallow(<Password {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

import { AccountProfile, mapStateToProps } from "../Profile";

describe("<AccountProfile />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "foo",
            identicon: "randomhashof15c",
            groups: ["test"],
            administrator: false
        };
    });

    it("should render when administrator", () => {
        props.administrator = true;
        const wrapper = shallow(<AccountProfile {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when not administrator", () => {
        const wrapper = shallow(<AccountProfile {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    const state = {
        account: {
            id: "foo",
            identicon: "randomhashof15c",
            groups: ["test"],
            administrator: true
        }
    };
    const expected = {
        id: "foo",
        identicon: "randomhashof15c",
        groups: ["test"],
        administrator: true
    };
    it("should return props when administrator", () => {
        const props = mapStateToProps(state);
        expect(props).toEqual(expected);
    });
    it("should return props when not administrator", () => {
        state.account.administrator = false;
        const props = mapStateToProps(state);
        expect(props).toEqual({ ...expected, administrator: false });
    });
});

import { AccountProfile, mapStateToProps } from "../Profile";

describe("<AccountProfile />", () => {
    let props;

    beforeEach(() => {
        props = {
            handle: "foo",
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
            handle: "foo",
            groups: ["test"],
            administrator: true
        }
    };
    const expected = {
        handle: "foo",
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

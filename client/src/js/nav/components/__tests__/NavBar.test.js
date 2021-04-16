import { Bar, mapStateToProps, mapDispatchToProps } from "../NavBar";

describe("<Bar />", () => {
    const props = {
        administrator: true,
        id: "foo",
        pending: false,
        onLogout: jest.fn()
    };
    it("should render", () => {
        const wrapper = shallow(<Bar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    const state = {
        account: { foo: "bar" },
        app: {
            pending: false
        }
    };
    it("should return props", () => {
        const result = mapStateToProps(state);
        expect(result).toEqual({
            foo: "bar",
            pending: false
        });
    });
});

describe("mapDispatchToProps", () => {
    const dispatch = jest.fn();

    it("should return onLogout in props", () => {
        const props = mapDispatchToProps(dispatch);
        props.onLogout();
        expect(dispatch).toHaveBeenCalled();
    });
});

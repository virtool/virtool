import { Bar, mapStateToProps, mapDispatchToProps } from "../NavBar";

describe("<Bar />", () => {
    const props = {
        onGet: jest.fn(),
        id: "foo",
        administrator: true,
        logout: jest.fn(),
        pending: false
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

    it("should return logout in props", () => {
        const props = mapDispatchToProps(dispatch);
        props.logout();
        expect(dispatch).toHaveBeenCalled();
    });

    it("should return onGet in props", () => {
        const props = mapDispatchToProps(dispatch);
        props.onGet();
        expect(dispatch).toHaveBeenCalled();
    });
});

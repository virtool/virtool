import { REMOVE_API_KEY, UPDATE_API_KEY } from "../../../../app/actionTypes";
import { Button, Icon } from "../../../../base";
import { APIKey, getInitialState, mapDispatchToProps, mapStateToProps } from "../Key";

describe("getInitialState()", () => {
    it("should return expected initial state", () => {
        const props = {
            apiKey: {
                permissions: { foo: false, bar: true, baz: false }
            }
        };

        const result = getInitialState(props);

        expect(result).toEqual({
            in: false,
            changed: false,
            permissions: props.apiKey.permissions
        });
    });
});

describe("<APIKey />", () => {
    let props;

    beforeEach(() => {
        props = {
            apiKey: {
                permissions: { foo: false, bar: true, baz: false },
                created_at: "2018-02-14T17:12:00.000000Z",
                name: "tester",
                id: "123abc"
            },
            onRemove: jest.fn(),
            onUpdate: jest.fn()
        };
    });

    it("should render when collapsed", () => {
        const wrapper = shallow(<APIKey {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when expanded", () => {
        const wrapper = shallow(<APIKey {...props} />);
        wrapper.setState({ in: true });
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [state.changed=true]", () => {
        const wrapper = shallow(<APIKey {...props} />);
        wrapper.setState({ changed: true });
        expect(wrapper).toMatchSnapshot();
    });

    it("should set [state.in=true] when clicked while collapsed", () => {
        const wrapper = shallow(<APIKey {...props} />);
        wrapper.simulate("click");
        expect(wrapper.state("in")).toBe(true);
    });

    it("should set [state.in=false] when close button clicked while expanded", () => {
        const wrapper = shallow(<APIKey {...props} />);
        wrapper.setState({ in: true });
        wrapper.find(Icon).simulate("click");
        expect(wrapper.state("in")).toBe(false);
    });

    it("should not set [state.in=false] when clicked while expanded", () => {
        const wrapper = shallow(<APIKey {...props} />);
        wrapper.setState({ in: true });
        wrapper.simulate("click");
        expect(wrapper.state("in")).toBe(true);
    });

    it("should call props.onUpdate when update button clicked", () => {
        const wrapper = shallow(<APIKey {...props} />);
        wrapper.setState({ changed: true, in: true });
        wrapper.find(Button).find({ icon: "save" }).simulate("click");
        expect(props.onUpdate).toHaveBeenCalledWith(props.apiKey.id, props.apiKey.permissions);
    });

    it("should call props.onRemove when remove button clicked", () => {
        const wrapper = shallow(<APIKey {...props} />);
        wrapper.setState({ in: true });
        wrapper.find(Button).find({ icon: "trash" }).simulate("click");
        expect(props.onRemove).toHaveBeenCalledWith(props.apiKey.id);
    });

    describe("onPermissionChange()", () => {
        it("should update state.permissions correctly", () => {
            const wrapper = shallow(<APIKey {...props} />);

            // State should initially match permissions in props.
            expect(wrapper.state("permissions")).toEqual(props.apiKey.permissions);

            wrapper.instance().onPermissionChange("foo", true);

            expect(wrapper.state("permissions")).toEqual({ ...props.apiKey.permissions, foo: true });
        });

        it("should have [state.changed=true] when permissions changed", () => {
            const wrapper = shallow(<APIKey {...props} />);

            // [state.changed] should be false initially.
            expect(wrapper.state("changed")).toBe(false);

            wrapper.instance().onPermissionChange("foo", true);

            // [state.changed] should be true when permissions have changed.
            expect(wrapper.state("changed")).toBe(true);
        });

        it("should have [state.changed=false] when permissions are unchanged", () => {
            const wrapper = shallow(<APIKey {...props} />);

            // [state.changed] should be false initially.
            expect(wrapper.state("changed")).toBe(false);

            // Call method twice with a net non-change in permissions.
            wrapper.instance().onPermissionChange("foo", true);
            wrapper.instance().onPermissionChange("foo", false);

            // Since no net change, [changed=false].
            expect(wrapper.state("changed")).toBe(false);
        });
    });
});

describe("mapStateToProps", () => {
    it("should return expected props", () => {
        const permissions = { foo: false, bar: true, baz: false };

        const state = {
            account: {
                permissions
            }
        };

        expect(mapStateToProps(state)).toEqual({
            permissions
        });
    });
});

describe("mapDispatchToProps", () => {
    let dispatch;
    let result;

    beforeEach(() => {
        dispatch = jest.fn();
        result = mapDispatchToProps(dispatch);
    });

    it("should return functional props.onRemove()", () => {
        const keyId = "foo";
        result.onRemove(keyId);
        expect(dispatch).toHaveBeenCalledWith({
            type: REMOVE_API_KEY.REQUESTED,
            keyId
        });
    });

    it("should return functional props.onUpdate()", () => {
        const permissions = { bar: true };
        result.onUpdate("foo", permissions);
        expect(dispatch).toHaveBeenCalledWith({
            type: UPDATE_API_KEY.REQUESTED,
            keyId: "foo",
            permissions
        });
    });
});

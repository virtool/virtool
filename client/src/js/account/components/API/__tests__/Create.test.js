import { CLEAR_API_KEY, CREATE_API_KEY } from "../../../../app/actionTypes";
import { CreateAPIKey, getInitialState, mapDispatchToProps, mapStateToProps } from "../Create";
import * as utils from "../../../../utils/utils";

const connectedReactRouter = require("connected-react-router");

jest.mock("connected-react-router");

const createMockEvent = value => {
    const e = {
        preventDefault: jest.fn()
    };

    if (value) {
        e.target = {
            value
        };
    }

    return e;
};

const expectedInitialState = {
    name: "",
    permissions: { foo: false, bar: false },
    submitted: false,
    copied: false,
    error: "",
    show: false
};

describe("getInitialState()", () => {
    it("should return correct initial state", () => {
        const props = {
            permissions: { foo: false, bar: true }
        };

        expect(getInitialState(props)).toEqual(expectedInitialState);
    });
});

describe("<CreateAPIKey />", () => {
    let props;

    beforeEach(() => {
        props = {
            newKey: "",
            permissions: { foo: false, bar: true },
            onCreate: jest.fn(),
            onHide: jest.fn(),
            show: true
        };
    });

    it("should render when [state.newKey] is empty", () => {
        const wrapper = shallow(<CreateAPIKey {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [state.newKey] set", () => {
        props.newKey = "123abc";
        const wrapper = shallow(<CreateAPIKey {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [props.newKey] and [state.copied] set", () => {
        props.newKey = "123abc";
        const wrapper = shallow(<CreateAPIKey {...props} />);
        wrapper.setState({ copied: true });
        expect(wrapper).toMatchSnapshot();
    });

    it("should set [state.copied=true] when key copied", () => {
        props.newKey = "123abc";
        const wrapper = shallow(<CreateAPIKey {...props} />);
        expect(wrapper.state("copied")).toBe(false);
        wrapper.find("CopyToClipboard").prop("onCopy")();
        expect(wrapper.state("copied")).toBe(true);
    });

    it("should update [state.name] and [state.error] when input changes", () => {
        const wrapper = shallow(<CreateAPIKey {...props} />);
        wrapper.find("InputError").prop("onChange")(createMockEvent("foo"));
        expect(wrapper.state("name")).toBe("foo");
    });

    describe("handleModalExited()", () => {
        it("should update state when called", () => {
            const wrapper = shallow(<CreateAPIKey {...props} />);
            wrapper.setState({
                permissions: { foo: true }
            });
            wrapper.instance().handleModalExited();
            expect(wrapper.state()).toEqual(expectedInitialState);
        });
    });

    describe("handlePermissionChange()", () => {
        it("should update [state.permissions]", () => {
            const wrapper = shallow(<CreateAPIKey {...props} />);
            wrapper.instance().handlePermissionChange("foo", true);
            expect(wrapper.state("permissions")).toEqual({ foo: true, bar: false });
        });
    });

    describe("handleSubmit()", () => {
        it("should call preventDefault on event", () => {
            const wrapper = shallow(<CreateAPIKey {...props} />);
            const e = createMockEvent();
            wrapper.instance().handleSubmit(e);
            expect(e.preventDefault).toHaveBeenCalled();
        });

        it("should set [state.error='Required Field'] on submit when name missing", () => {
            const wrapper = shallow(<CreateAPIKey {...props} />);
            wrapper.instance().handleSubmit(createMockEvent());
            expect(wrapper.state("error")).toBe("Required Field");
        });

        it("should set [state.submitted=true] and call props.onCreate()", () => {
            const name = "Foo 1";
            const permissions = { foo: true, bar: true };

            const wrapper = shallow(<CreateAPIKey {...props} />);
            wrapper.setState({
                name,
                permissions
            });
            wrapper.instance().handleSubmit(createMockEvent());

            expect(wrapper.state("submitted")).toBe(true);
            expect(props.onCreate).toHaveBeenCalledWith(name, permissions);
        });
    });
});

describe("mapStateToProps", () => {
    it.each([true, false])("should return props when routerLocationHasState() returns %p", show => {
        const spy = jest.spyOn(utils, "routerLocationHasState");

        spy.mockImplementation(() => show);

        const newKey = "123abc";
        const permissions = { foo: true };

        const state = {
            account: {
                newKey,
                permissions
            }
        };

        expect(mapStateToProps(state)).toEqual({
            newKey,
            permissions,
            show
        });

        expect(utils.routerLocationHasState).toHaveBeenCalledWith(state, "createAPIKey");
    });
});

describe("mapDispatchToProps()", () => {
    let dispatch;
    let props;

    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return functional props.onCreate", () => {
        const name = "foo";
        const permissions = { bar: true };

        props.onCreate(name, permissions);

        expect(dispatch).toHaveBeenCalledWith({
            type: CREATE_API_KEY.REQUESTED,
            name,
            permissions
        });
    });

    it("should return functional props.onHide", () => {
        const pushAction = {
            type: "PUSH",
            foo: "bar"
        };

        connectedReactRouter.push.mockReturnValue(pushAction);

        props.onHide();

        expect(dispatch).toHaveBeenCalledWith(pushAction);
        expect(dispatch).toHaveBeenCalledWith({
            type: CLEAR_API_KEY
        });
    });
});

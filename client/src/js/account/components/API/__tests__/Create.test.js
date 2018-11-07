import { CopyToClipboard } from "react-copy-to-clipboard";
import { Modal } from "react-bootstrap";
import { InputError } from "../../../../base/index";
import * as actions from "../../../actions";
import CreateAPIKeyContainer, { getInitialState, CreateAPIKey } from "../Create";

describe("<CreateAPIKey />", () => {
    let initialState;
    let store;
    let props;
    let wrapper;
    let spy;

    it("renders correctly", () => {
        initialState = {
            router: {
                location: {
                    state: { createAPIKey: true }
                }
            },
            account: {
                newKey: "123abc",
                permissions: { foo: true, bar: false }
            }
        };
        store = mockStore(initialState);

        wrapper = shallow(<CreateAPIKeyContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("getDerivedStateFromProps()", () => {
        let nextProps = { newKey: "123abc" };
        let prevState = { show: false };
        let result = CreateAPIKey.getDerivedStateFromProps(nextProps, prevState);
        expect(result).toEqual({ show: true });

        nextProps = { newKey: "" };
        prevState = { show: true };
        result = CreateAPIKey.getDerivedStateFromProps(nextProps, prevState);
        expect(result).toEqual(null);
    });

    it("handleModalExited()", () => {
        props = { permissions: { foo: true } };
        wrapper = shallow(<CreateAPIKey {...props} />);

        const initialState = getInitialState(props);
        expect(wrapper.state()).toEqual(initialState);

        wrapper.setProps({ permissions: { test: false } });
        wrapper.find(Modal).prop("onExited")();

        expect(wrapper.state()).toEqual({
            ...initialState,
            permissions: { test: false }
        });
    });

    it("handlePermissionChange()", () => {
        props = { permissions: { foo: false } };
        wrapper = mount(<CreateAPIKey {...props} />);
        spy = sinon.spy(wrapper.instance(), "handlePermissionChange");
        wrapper.instance().handlePermissionChange("foo", true);

        expect(spy.called).toBe(true);
        expect(wrapper.state("permissions")).toEqual({ foo: true });
    });

    it("Clicking copy button sets state.copied to true", () => {
        props = {
            show: true,
            permissions: { foo: false }
        };
        wrapper = mount(<CreateAPIKey {...props} />);
        expect(wrapper.state("copied")).toBe(false);

        wrapper.setState({ show: true });
        wrapper.find(CopyToClipboard).prop("onCopy")();
        expect(wrapper.state("copied")).toBe(true);
    });

    it("User input sets state.name", () => {
        props = {
            show: true,
            permissions: { foo: false }
        };
        wrapper = mount(<CreateAPIKey {...props} />);
        expect(wrapper.state("name")).toEqual("");

        wrapper.find(InputError).prop("onChange")({ target: { value: "test" } });
        expect(wrapper.state("name")).toEqual("test");
    });

    describe("dispatch functions", () => {
        beforeAll(() => {
            initialState = {
                router: {
                    location: {
                        state: { createAPIKey: true }
                    }
                },
                account: {
                    newKey: "",
                    permissions: { foo: false, bar: true }
                }
            };
            store = mockStore(initialState);

            wrapper = mount(<CreateAPIKeyContainer store={store} />);
        });

        afterEach(() => {
            spy.restore();
        });

        it("Form submit dispatches createAPIKey() action", () => {
            spy = sinon.spy(actions, "createAPIKey");
            expect(spy.called).toBe(false);

            const target = wrapper.find("form");

            target.prop("onSubmit")({ preventDefault: jest.fn() });
            expect(spy.called).toBe(false);

            wrapper
                .children()
                .instance()
                .setState({ name: "test" });
            target.prop("onSubmit")({ preventDefault: jest.fn() });

            expect(spy.calledWith("test", { foo: false, bar: false })).toBe(true);
        });

        it("Modal exit closes modal and dispatches clearAPIKey() action", () => {
            spy = sinon.spy(actions, "clearAPIKey");
            expect(spy.called).toBe(false);

            wrapper.children().prop("onHide")();
            expect(spy.calledOnce).toBe(true);
        });
    });
});

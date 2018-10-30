import { ClipLoader } from "halogenium";
import { Panel } from "react-bootstrap";
import { Checkbox, Icon, InputError, Button, FlexItem } from "../../../base";
import * as actions from "../../actions";
import ProxyOptionsContainer, { ProxyFooter, ProxyTestIcon, ProxyOptions } from "./Proxy";

describe("<Proxy />", () => {
    const initialState = {
        settings: {
            data: {
                proxy_address: "test_address",
                proxy_enable: false,
                proxy_username: "test_name",
                proxy_password: "test_pass",
                proxy_trust: false
            },
            proxyTestPending: false,
            proxyTestSucceeded: false,
            proxyTestFailed: false
        }
    };
    const store = mockStore(initialState);
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<ProxyOptionsContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    describe("renders ProxyTestIcon correctly", () => {
        it("show loading when pending", () => {
            wrapper = shallow(<ProxyTestIcon proxyTestPending={true} />);
            expect(wrapper.find(ClipLoader).exists()).toBe(true);
            expect(wrapper).toMatchSnapshot();
        });

        it("show success icon when succeeded", () => {
            wrapper = shallow(<ProxyTestIcon proxyTestSucceeded={true} />);
            expect(wrapper.find(Icon).exists()).toBe(true);
            expect(wrapper.find(Icon).prop("bsStyle")).toEqual("success");
            expect(wrapper).toMatchSnapshot();
        });

        it("show disabled icon when failed", () => {
            wrapper = shallow(<ProxyTestIcon proxyTestFailed={true} />);
            expect(wrapper.find(Icon).exists()).toBe(true);
            expect(wrapper.find(Icon).prop("bsStyle")).toEqual("danger");
            expect(wrapper).toMatchSnapshot();
        });
    });

    it("renders ProxyFooter correctly", () => {
        wrapper = shallow(<ProxyFooter />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders ProxyOptions correctly", () => {
        props = {
            address: "test_address",
            username: "test_username",
            password: "test_password",
            trust: false,
            proxyTestPending: false,
            proxyTestSucceeded: false
        };
        wrapper = shallow(<ProxyOptions {...props} enabled={false} proxyTestFailed={false} />);
        expect(wrapper).toMatchSnapshot();

        wrapper = shallow(<ProxyOptions {...props} enabled={true} proxyTestFailed={true} />);
        expect(wrapper).toMatchSnapshot();
    });

    describe("dispatch functions", () => {
        let spyUpdateSetting;
        let spyTestProxy;

        beforeAll(() => {
            spyUpdateSetting = sinon.spy(actions, "updateSetting");
            spyTestProxy = sinon.spy(actions, "testProxy");
            wrapper = mount(<ProxyOptionsContainer store={store} />);
        });

        afterEach(() => {
            spyUpdateSetting.resetHistory();
        });

        afterAll(() => {
            spyUpdateSetting.restore();
            spyTestProxy.restore();
        });

        it("Clicking proxy test button dispatches testProxy() action", () => {
            expect(spyTestProxy.called).toBe(false);
            wrapper
                .find(Panel.Body)
                .children()
                .find(FlexItem)
                .children()
                .find(Button)
                .prop("onClick")();
            expect(spyTestProxy.calledOnce).toBe(true);
        });

        it("Toggling enable checkbox dispatches updateSetting() action to update 'proxy_enable' field", () => {
            expect(spyUpdateSetting.called).toBe(false);
            wrapper
                .find(Checkbox)
                .at(0)
                .prop("onClick")();
            expect(spyUpdateSetting.calledWith("proxy_enable", true)).toBe(true);
        });

        it("Submitting Address input dispatches updateSetting() action to update 'proxy_address' field", () => {
            expect(spyUpdateSetting.called).toBe(false);
            wrapper
                .find(InputError)
                .at(0)
                .prop("onSave")({ value: "foobar" });
            expect(spyUpdateSetting.calledWith("proxy_address", "foobar")).toBe(true);
        });

        it("Submitting Username input dispatches updateSetting() action to update 'proxy_username' field", () => {
            expect(spyUpdateSetting.called).toBe(false);
            wrapper
                .find(InputError)
                .at(1)
                .prop("onSave")({ value: "helloworld" });
            expect(spyUpdateSetting.calledWith("proxy_username", "helloworld")).toBe(true);
        });

        it("Submitting Password input dispatches updateSetting() action to update 'proxy_password' field", () => {
            expect(spyUpdateSetting.called).toBe(false);
            wrapper
                .find(InputError)
                .at(2)
                .prop("onSave")({ value: "123abc" });
            expect(spyUpdateSetting.calledWith("proxy_password", "123abc")).toBe(true);
        });

        it("Toggling Trust Env Var checkbox dispatches updateSetting() to update 'proxy_trust' field", () => {
            expect(spyUpdateSetting.called).toBe(false);
            wrapper
                .find(Checkbox)
                .at(1)
                .prop("onClick")();
            expect(spyUpdateSetting.calledWith("proxy_trust", true)).toBe(true);
        });
    });
});

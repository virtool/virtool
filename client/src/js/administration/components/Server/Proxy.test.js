import ProxyOptionsContainer, {
    ProxyFooter,
    ProxyTestIcon,
    ProxyOptions
} from "./Proxy";
import { ClipLoader } from "halogenium";
import { Icon } from "../../../base";

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

});

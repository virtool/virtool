import { Button } from "../../../../base/index";
import * as actions from "../../../actions";
import APIKeyContainer, { APIKey } from "../Key";

describe("<APIKey />", () => {
    const initialState = {
        account: {
            permissions: { foo: false, test: false }
        }
    };
    const store = mockStore(initialState);
    let wrapper;
    let props = {
        apiKey: {
            permissions: { foo: false },
            created_at: "2018-02-14T17:12:00.000000Z",
            name: "tester",
            id: "123abc"
        }
    };

    it("renders correctly", () => {
        wrapper = shallow(<APIKeyContainer store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("toggleIn(): toggles api key between list entry and expanded state", () => {
        props = {
            ...props,
            apiKey: { ...props.apiKey, permissions: { foo: true } },
            permissions: { foo: false, test: false }
        };
        wrapper = mount(<APIKey {...props} />);

        expect(wrapper.state()).toEqual({
            in: false,
            changed: false,
            permissions: props.apiKey.permissions
        });
        wrapper.setState({
            in: true,
            changed: true,
            permissions: { foo: false, test: true }
        });
        wrapper.instance().toggleIn();

        expect(wrapper.state()).toEqual({
            in: false,
            changed: true,
            permissions: { foo: true }
        });
    });

    it("onPermissionChange(): sets updated permissions to component state", () => {
        props = {
            ...props,
            apiKey: { ...props.apiKey, permissions: { foo: true, test: true } },
            permissions: { foo: false, test: false }
        };
        wrapper = mount(<APIKey {...props} />);

        expect(wrapper.state()).toEqual({
            in: false,
            changed: false,
            permissions: props.apiKey.permissions
        });
        wrapper.instance().onPermissionChange("foo", false);

        expect(wrapper.state()).toEqual({
            in: false,
            changed: true,
            permissions: { foo: false, test: true }
        });
    });

    describe("dispatch functions", () => {
        let spy;

        it("Clicking Remove button dispatches removeAPIKey() action", () => {
            spy = sinon.spy(actions, "removeAPIKey");
            expect(spy.called).toBe(false);

            wrapper = mount(<APIKeyContainer store={store} {...props} />);
            wrapper
                .children()
                .instance()
                .toggleIn();
            wrapper.update();
            wrapper
                .find(Button)
                .at(0)
                .prop("onClick")();

            expect(spy.calledWith(props.apiKey.id)).toBe(true);
        });

        it("Clicking Update button dispatches updateAPIKey() action", () => {
            spy = sinon.spy(actions, "updateAPIKey");
            expect(spy.called).toBe(false);

            wrapper = mount(<APIKeyContainer store={store} {...props} />);
            wrapper
                .children()
                .instance()
                .toggleIn();
            wrapper.update();
            wrapper
                .find(Button)
                .at(1)
                .prop("onClick")();

            expect(spy.calledWith(props.apiKey.id, props.apiKey.permissions)).toBe(true);
        });
    });
});

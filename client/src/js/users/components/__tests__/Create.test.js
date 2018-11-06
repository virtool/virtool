import * as actions from "../../actions";
import CreateUserContainer, { CreateUser } from "../Create";

describe("<CreateUser />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            show: true,
            pending: false,
            minPassLen: 8,
            error: "",
            onCreate: sinon.spy(),
            onHide: sinon.spy(),
            onClearError: sinon.spy()
        };

        wrapper = shallow(<CreateUser {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    describe("Dispatch Functions", () => {
        const initialState = {
            router: { location: { state: { createUser: true } } },
            users: { createPending: false },
            settings: { data: { minimum_password_length: 8 } },
            errors: null
        };
        const store = mockStore(initialState);
        let spy;

        afterEach(() => {
            spy.restore();
        });

        it("Submitting form dispatches createUser() action", () => {
            spy = sinon.spy(actions, "createUser");
            expect(spy.called).toBe(false);

            wrapper = mount(<CreateUserContainer store={store} />);
            wrapper
                .find({ label: "Username" })
                .at(0)
                .prop("onChange")({ target: { name: "userId", value: "test-user" } });
            wrapper
                .find({ label: "Password" })
                .at(0)
                .prop("onChange")({
                target: { name: "password", value: "test-password" }
            });
            wrapper
                .find({ label: "Confirm" })
                .at(0)
                .prop("onChange")({
                target: { name: "confirm", value: "test-password" }
            });

            wrapper.find("form").prop("onSubmit")({ preventDefault: jest.fn() });

            expect(
                spy.calledWith({
                    userId: "test-user",
                    password: "test-password",
                    confirm: "test-password",
                    forceReset: false
                })
            ).toBe(true);
        });
    });
});

import PasswordContainer, { ChangePassword as Password } from "./Password";
import * as actions from "../actions";
import * as errorActions from "../../errors/actions";
import { InputError } from "../../base";

describe("<Password />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        const initialState = {
            account: {
                last_password_change: "2018-02-14T12:00:00.000000Z",
            },
            settings: {
                data: {
                    minimum_password_length: 8
                }
            },
            error: null
        };
        const store = mockStore(initialState);
        wrapper = shallow(<PasswordContainer store={store} />).dive();

        expect(wrapper).toMatchSnapshot();
    });

    describe("componentWillReceiveProps", () => {
        let spyCWRP;

        beforeAll(() => {
            spyCWRP = sinon.spy(Password.prototype, "componentWillReceiveProps");
        });

        afterAll(() => {
            spyCWRP.restore();
        });

        beforeEach(() => {
            spyCWRP.resetHistory();
        });

        it("if failed request error occurs and [error.status=400], set error as invalid old password", () => {
            props = {
                lastPasswordChange: "2018-02-14T12:00:00.000000Z",
                settings: {
                    minimum_password_length: 8
                },
                error: null
            };
            wrapper = shallow(<Password {...props} />);

            expect(spyCWRP.called).toBe(false);
            expect(wrapper.state('errorOldPassword')).toEqual("");

            const update = {
                lastPasswordChange: "2018-02-14T12:00:00.000000Z",
                settings: {
                    minimum_password_length: 8
                },
                error: {
                        status: 400,
                        message: "test message"
                    }
            };

            wrapper.setProps(update);

            expect(spyCWRP.calledOnce).toBe(true);
            expect(wrapper.state('errorOldPassword')).toEqual("test message"); 
        });

        it("if failed request error occurs and [error.status!=400], set error as invalid old password length", () => {
            props = {
                lastPasswordChange: "2018-02-14T12:00:00.000000Z",
                settings: {
                    minimum_password_length: 8
                },
                error: null
            };
            wrapper = shallow(<Password {...props} />);

            expect(spyCWRP.called).toBe(false);
            expect(wrapper.state('errorOldPassword')).toEqual("");

            const update = {
                lastPasswordChange: "2018-02-14T12:00:00.000000Z",
                settings: {
                    minimum_password_length: 8
                },
                error: {
                        status: 409,
                        message: "else branch test message"
                    }
            };

            wrapper.setProps(update);

            expect(spyCWRP.calledOnce).toBe(true);
            expect(wrapper.state('errorOldPassword'))
                .toEqual(`Passwords must contain at least ${update.settings.minimum_password_length} characters`); 
        });

        it("if password change successful, clear form errors", () => {
            props = {
                lastPasswordChange: "2016-02-14T12:00:00.000000Z",
                settings: {
                    minimum_password_length: 8
                },
                error: null
            };
            wrapper = shallow(<Password {...props} />);
            wrapper.setState({ errorOldPassword: "test error" });

            expect(spyCWRP.called).toBe(false);
            expect(wrapper.state('errorOldPassword')).toEqual("test error");

            const update = {
                lastPasswordChange: "2018-04-15T00:00:00.123456Z",
                settings: {
                    minimum_password_length: 8
                },
                error: null
            };

            wrapper.setProps(update);

            expect(spyCWRP.calledOnce).toBe(true);
            expect(wrapper.state('errorOldPassword')).toEqual(""); 
        });
    });

    describe("handleChange", () => {

        it("calls clear error dispatch action if props.error is set", () => {
            const spyClearError = sinon.spy(errorActions, "clearError");

            const initialState = {
                account: {
                    lastPasswordChange: "2018-02-14T12:00:00.000000Z",
                },
                settings: {
                    minimum_password_length: 8
                },
                error: null
            };
            const store = mockStore(initialState);
            const container = shallow(<PasswordContainer store={store} />);
            wrapper = container.dive();
            const spyChange = sinon.spy(wrapper.instance(), "handleChange");
            wrapper.instance().forceUpdate();
            wrapper.setState({ errorOldPassword: "test error" });

            expect(spyChange.called).toBe(false);
            expect(spyClearError.called).toBe(false);

            // If no error in store, clearError not called
            props = {
                lastPasswordChange: "2016-02-14T12:00:00.000000Z",
                settings: {
                    minimum_password_length: 8
                },
                error: null
            };
            wrapper.setProps(props);

            const mockEvent = {
                target: {
                    name: "oldPassword"
                }
            };
            wrapper.find(InputError).at(0).simulate('change', mockEvent);

            expect(spyChange.calledOnce).toBe(true);
            expect(spyClearError.called).toBe(false);

            // If error exists in store, clearError is dispatched
            props = {
                lastPasswordChange: "2016-02-14T12:00:00.000000Z",
                settings: {
                    minimum_password_length: 8
                },
                error: {
                    status: 400,
                    message: "existing error"
                }
            };
            wrapper.setProps(props);

            wrapper.find(InputError).at(0).simulate('change', mockEvent);

            expect(spyChange.calledTwice).toBe(true);
            expect(spyClearError.calledOnceWith("CHANGE_ACCOUNT_PASSWORD_ERROR")).toBe(true);

            spyClearError.restore();
            spyChange.restore();
        });

    });

    describe("onSubmit", () => {
        let spySubmit;
        let mockEvent;
        let expected;

        beforeAll(() => {
            props = {
                lastPasswordChange: "2016-02-14T12:00:00.000000Z",
                settings: {
                    minimum_password_length: 8
                },
                error: null
            };
            wrapper = mount(<Password {...props} />);
            spySubmit = sinon.spy(wrapper.instance(), "onSubmit");
            wrapper.instance().forceUpdate();

            wrapper.setState({
                oldPassword: "",
                newPassword: "short",
                confirmPassword: "mismatch"
            });
            expect(spySubmit.called).toBe(false);

            mockEvent = {
                preventDefault: jest.fn()
            };
            wrapper.find('form').simulate('submit', mockEvent);
        });

        afterAll(() => {
            spySubmit.restore();
        });

        it("sets state.errorOldPassword if old password field is empty", () => {
            expected = "Please provide your old password";

            expect(spySubmit.calledOnce).toBe(true);
            expect(wrapper.state('errorOldPassword')).toEqual(expected);
        });

        it("sets state.errorNewPassword if new password is too short", () => {
            expected = `Passwords must contain at least ${props.settings.minimum_password_length} characters`;

            expect(spySubmit.calledOnce).toBe(true);
            expect(wrapper.state('errorNewPassword')).toEqual(expected);
        });

        it("sets confirm password error if confirm does not match new password", () => {
            expected = "New passwords do not match";

            expect(spySubmit.calledOnce).toBe(true);
            expect(wrapper.state('errorConfirmPassword')).toEqual(expected);
        });

        it("if there are no errors set, call change password dispatch action", () => {
            const spyChangePassword = sinon.spy(actions, "changePassword");

            const initialState = {
                account: {
                    last_password_change: "2018-02-14T12:00:00.000000Z",
                },
                settings: {
                    data: {
                        minimum_password_length: 8
                    }
                },
                error: null
            };
            const store = mockStore(initialState);
            const container = shallow(<PasswordContainer store={store} />);
            wrapper = container.dive();
            const spy = sinon.spy(wrapper.instance(), "onSubmit");
            wrapper.instance().forceUpdate();

            const newState = {
                oldPassword: "test",
                newPassword: "testtesttest",
                confirmPassword: "testtesttest"
            };
            wrapper.setState(newState);

            expect(spy.called).toBe(false);

            mockEvent = {
                preventDefault: jest.fn()
            };
            wrapper.find('form').simulate('submit', mockEvent);

            expect(spy.calledOnce).toBe(true);
            expect(spyChangePassword.calledOnceWith(
                newState.oldPassword, newState.newPassword
            )).toBe(true);

            spy.restore();
            spyChangePassword.restore();
        });
    });

});

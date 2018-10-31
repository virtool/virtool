import * as actions from "../actions";
import * as errorActions from "../../errors/actions";
import { InputError } from "../../base";
import EmailContainer, { Email } from "./Email";

describe("<Email />", () => {
    let wrapper;

    it("renders correctly", () => {
        const initialState = {
            account: {
                email: "test@virtool.ca"
            },
            errors: null
        };
        const store = mockStore(initialState);
        wrapper = shallow(<EmailContainer store={store} />);

        expect(wrapper.dive()).toMatchSnapshot();
    });

    describe("dispatch actions", () => {
        let spyUpdateAccount;
        let spyClearError;
        let expected;
        let initialState;
        let mockEvent;

        beforeAll(() => {
            spyUpdateAccount = sinon.spy(actions, "updateAccount");
            spyClearError = sinon.spy(errorActions, "clearError");

            initialState = {
                account: {
                    email: "test@virtool.ca"
                },
                errors: null
            };
            const store = mockStore(initialState);
            wrapper = shallow(<EmailContainer store={store} />).dive();
        });

        afterAll(() => {
            spyUpdateAccount.restore();
            spyClearError.restore();
        });

        it("submitting a valid email dispatches account update action", () => {
            expect(spyUpdateAccount.called).toBe(false);

            mockEvent = {
                preventDefault: jest.fn()
            };
            wrapper.find("form").simulate("submit", mockEvent);

            expected = {
                email: initialState.account.email
            };

            expect(spyUpdateAccount.calledOnceWith(expected)).toBe(true);
        });

        it("changing input value of email dispatches clear error action", () => {
            expect(spyClearError.called).toBe(false);

            mockEvent = {
                target: {
                    value: "newemail@msn.sg"
                }
            };
            wrapper.setProps({ error: { UPDATE_ACCOUNT_ERROR: "Invalid input" } });
            wrapper.find(InputError).simulate("change", mockEvent);

            expect(spyClearError.calledOnceWith("UPDATE_ACCOUNT_ERROR")).toBe(true);
        });
    });

    describe("handleChange", () => {
        let spyChange;

        afterEach(() => {
            spyChange.restore();
        });

        it("sets state with new email via user input", () => {
            wrapper = mount(<Email />);
            spyChange = sinon.spy(wrapper.instance(), "handleChange");
            wrapper.instance().forceUpdate();

            expect(spyChange.calledOnce).toBe(false);
            expect(wrapper.state("email")).toEqual("");

            const mockEvent = {
                target: {
                    value: "newtestemail@github.com"
                }
            };
            wrapper.find("input").simulate("change", mockEvent);

            expect(spyChange.calledOnce).toBe(true);
            expect(wrapper.state("email")).toEqual(mockEvent.target.value);
        });

        it("if a previously failed request error exists in state, dispatch clearError", () => {
            const props = {
                error: "Invalid input",
                onClearError: sinon.spy()
            };
            wrapper = mount(<Email {...props} />);
            spyChange = sinon.spy(wrapper.instance(), "handleChange");
            wrapper.instance().forceUpdate();

            expect(spyChange.calledOnce).toBe(false);

            const mockEvent = {
                target: {
                    value: "test"
                }
            };
            wrapper.find("input").simulate("change", mockEvent);

            expect(props.onClearError.calledOnceWith("UPDATE_ACCOUNT_ERROR")).toBe(true);
        });
    });

    describe("handleBlur", () => {
        let spyBlur;
        let props;

        beforeEach(() => {
            props = {
                email: "original@gmail.com"
            };
            wrapper = mount(<Email {...props} />);
            spyBlur = sinon.spy(wrapper.instance(), "handleBlur");
            wrapper.instance().forceUpdate();
        });

        afterEach(() => {
            spyBlur.restore();
        });

        it("sets state with original email and clears error if a non-focus element was clicked", () => {
            expect(spyBlur.calledOnce).toBe(false);
            expect(wrapper.state("email")).toEqual(props.email);

            const mockEvent = {
                relatedTarget: undefined
            };
            wrapper.find("input").simulate("blur", mockEvent);

            expect(spyBlur.calledOnce).toBe(true);
            expect(wrapper.state("email")).toEqual(props.email);
        });

        it("does nothing if a related focus element was clicked", () => {
            expect(spyBlur.calledOnce).toBe(false);

            const mockEvent = {
                relatedTarget: {
                    type: "submit"
                }
            };
            wrapper.find("input").simulate("blur", mockEvent);

            expect(spyBlur.calledOnce).toBe(true);
        });
    });

    describe("onSubmit handler", () => {
        let spySubmit;
        let props;

        beforeEach(() => {
            props = {
                email: "testsubmit@virtool.com",
                onUpdateEmail: sinon.spy()
            };
            wrapper = mount(<Email {...props} />);
            spySubmit = sinon.spy(wrapper.instance(), "onSubmit");
            wrapper.instance().forceUpdate();
        });

        afterEach(() => {
            spySubmit.restore();
        });

        it("if submitted email is valid, dispatch onUpdateEmail", () => {
            expect(spySubmit.calledOnce).toBe(false);
            expect(wrapper.state("email")).toEqual(props.email);

            const mockEvent = {
                preventDefault: jest.fn()
            };
            wrapper.find("form").simulate("submit", mockEvent);

            const expected = {
                email: props.email
            };

            expect(spySubmit.calledOnce).toBe(true);
            expect(props.onUpdateEmail.calledOnceWith(expected)).toBe(true);
        });

        it("if submitted email is invalid, set state error", () => {
            expect(spySubmit.calledOnce).toBe(false);

            const mockEvent = {
                preventDefault: jest.fn()
            };

            wrapper.setState({ email: "invalidemail" });
            wrapper.find("form").simulate("submit", mockEvent);

            expect(spySubmit.calledOnce).toBe(true);
            expect(wrapper.state("error")).toEqual("Please provide a valid email address");
        });
    });
});

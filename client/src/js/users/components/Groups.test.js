import * as actions from "../actions";
import UserGroupsContainer, { UserGroup, UserGroups } from "./Groups";

describe("<UserGroups />", () => {
  let initialState;
  let store;
  let spy;
  let props = {
    userId: "foobar",
    onList: jest.fn(),
    onEditGroup: jest.fn()
  };
  let wrapper;

  it("renders correctly", () => {
    const currentProps = {
      ...props,
      allGroups: ["hello", "world"],
      memberGroups: ["hello"]
    };
    wrapper = shallow(<UserGroups {...currentProps} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders <NoneFound /> if no groups available", () => {
    const currentProps = {
      ...props,
      allGroups: [],
      memberGroups: []
    };
    wrapper = shallow(<UserGroups {...currentProps} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders <UserGroup /> subcomponent", () => {
    const currentProps = {
      userGroups: [],
      groupId: "test-group",
      userId: "test-user",
      toggled: false
    };
    wrapper = shallow(<UserGroup {...currentProps} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("Editing group membership dispatches editUser() action", () => {
    spy = sinon.spy(actions, "editUser");
    expect(spy.called).toBe(false);

    initialState = {
      groups: { list: [{ id: "hello" }, { id: "world" }] }
    };
    store = mockStore(initialState);
    props = {
      userId: "foobar",
      memberGroups: ["hello"]
    };
    wrapper = mount(<UserGroupsContainer store={store} {...props} />);
    wrapper
      .find({ className: "text-capitalize" })
      .at(0)
      .prop("onClick")();
    expect(spy.calledWith("foobar", { groups: [] })).toBe(true);

    wrapper.setProps({ memberGroups: [] });
    wrapper
      .find({ className: "text-capitalize" })
      .at(0)
      .prop("onClick")();
    expect(spy.calledWith("foobar", { groups: ["hello"] })).toBe(true);

    spy.restore();
  });
});

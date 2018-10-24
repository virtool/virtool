import { forEach, keys } from "lodash-es";
import { Icon } from "../../base";
import * as actions from "../actions";
import DataOptionsContainer, { WarningFooter, DataOptions } from "./Data";

describe("<Describe />", () => {
  const initialState = { settings: { data: {} } };
  const store = mockStore(initialState);
  let wrapper;

  it("renders <DataOptions /> correctly", () => {
    wrapper = shallow(<DataOptionsContainer store={store} />).dive();

    expect(wrapper).toMatchSnapshot();
  });

  it("renders <WarningFooter /> correctly", () => {
    wrapper = shallow(<WarningFooter />);

    expect(wrapper.find("small").length).toEqual(1);
    expect(wrapper.find(Icon).length).toEqual(1);

    expect(wrapper).toMatchSnapshot();
  });

  it("calls onSave callback function on input change and submission", () => {
    const spySave = sinon.spy();
    const props = {
      db_name: "virtool",
      db_host: "example",
      db_port: "1",
      data_path: "/",
      watch_path: "/"
    };
    wrapper = mount(<DataOptions {...props} onSave={spySave} />);

    const propsKeys = keys(props);

    forEach(propsKeys, (value, index) => {
      // Change input value by appending a 0
      wrapper
        .find("input")
        .at(index)
        .simulate("change", { target: { value: `${props[value]}0` } });
      wrapper
        .find("form")
        .at(index)
        .simulate("submit", {
          preventDefault: jest.fn(),
          value: `${props[value]}0`
        });

      if (value === "db_port") {
        expect(
          spySave.calledWith(propsKeys[index], Number(`${props[value]}0`))
        ).toBe(true);
      } else {
        expect(spySave.calledWith(propsKeys[index], `${props[value]}0`)).toBe(
          true
        );
      }
    });
  });

  it("calls dispatch function onSave", () => {
    wrapper = shallow(<DataOptionsContainer store={store} />).dive();

    const spyDispatch = sinon.spy(actions, "updateSetting");

    const adminElement = wrapper
      .children()
      .at(0)
      .shallow();
    const contentElement = adminElement
      .children()
      .at(2)
      .shallow();
    const divElement = contentElement
      .children()
      .children()
      .children()
      .at(0)
      .shallow();

    divElement
      .children()
      .at(0)
      .prop("onSave")({ value: "foobar" });

    expect(spyDispatch.calledWith("db_name", "foobar")).toBe(true);
  });
});

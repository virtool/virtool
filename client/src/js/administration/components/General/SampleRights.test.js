import * as actions from "../../actions";
import { InputError } from "../../../base";
import SampleRightsContainer from "./SampleRights";

describe("<SampleRights />", () => {
  let initialState;
  let store;
  let props;
  let wrapper;

  it("renders correctly", () => {
    initialState = {
      settings: {
        data: {
          sample_group: "none",
          sample_group_read: false,
          sample_group_write: false,
          sample_all_read: false,
          sample_all_write: false
        }
      }
    };
    store = mockStore(initialState);
    wrapper = shallow(
      <SampleRightsContainer store={store} {...props} />
    ).dive();
    expect(wrapper).toMatchSnapshot();
  });

  describe("dispatch functions", () => {
    let spyUpdateOne;
    let spyUpdateMultiple;
    let update;

    beforeAll(() => {
      spyUpdateOne = sinon.spy(actions, "updateSetting");
      spyUpdateMultiple = sinon.spy(actions, "updateSettings");

      initialState = {
        settings: {
          data: {
            sample_group: "none",
            sample_group_read: true,
            sample_group_write: true,
            sample_all_read: true,
            sample_all_write: true
          }
        }
      };
      store = mockStore(initialState);
      wrapper = mount(<SampleRightsContainer store={store} />);
    });

    afterAll(() => {
      spyUpdateOne.restore();
      spyUpdateMultiple.restore();
    });

    it("dispatches updateSetting when sample group changes", () => {
      expect(spyUpdateOne.called).toBe(false);

      wrapper
        .find(InputError)
        .at(0)
        .prop("onChange")({ target: { value: "test-group" } });
      expect(spyUpdateOne.calledWith("sample_group", "test-group")).toBe(true);
    });

    it("dispatches updateSettings when sample rights changes", () => {
      expect(spyUpdateMultiple.called).toBe(false);

      wrapper
        .find(InputError)
        .at(1)
        .prop("onChange")({ target: { value: "rw" } });
      update = {
        sample_group_read: true,
        sample_group_write: true
      };
      expect(spyUpdateMultiple.calledWith(update)).toBe(true);

      wrapper
        .find(InputError)
        .at(2)
        .prop("onChange")({ target: { value: "rw" } });
      update = {
        sample_all_read: true,
        sample_all_write: true
      };
      expect(spyUpdateMultiple.calledWith(update)).toBe(true);
    });
  });
});

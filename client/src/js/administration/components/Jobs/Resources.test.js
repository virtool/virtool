import { InputError, Alert } from "../../../base";
import * as actions from "../../actions";
import * as jobActions from "../../../jobs/actions";
import * as errorActions from "../../../errors/actions";
import ResourcesContainer, {
  getErrorMessage,
  LimitLabel,
  Resources
} from "./Resources";

describe("<Resources />", () => {
  const initialState = {
    jobs: {
      resources: {
        mem: { total: 1000, available: 500 },
        proc: [10, 15, 20]
      }
    },
    settings: {
      data: {
        create_sample_inst: 10,
        create_sample_mem: 5,
        create_sample_proc: 3,
        build_index_inst: 10,
        build_index_mem: 5,
        build_index_proc: 3,
        create_subtraction_inst: 10,
        create_subtraction_mem: 5,
        create_subtraction_proc: 3,
        pathoscope_bowtie_inst: 10,
        pathoscope_bowtie_mem: 5,
        pathoscope_bowtie_proc: 3,
        nuvs_inst: 10,
        nuvs_mem: 5,
        nuvs_proc: 3,
        proc: 3,
        mem: 5
      }
    },
    error: null
  };
  const store = mockStore(initialState);
  let props;
  let wrapper;

  it("renders correctly", () => {
    wrapper = shallow(<ResourcesContainer store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("getErrorMessage(): returns error message when [isError=true], otherwise returns false", () => {
    let result = getErrorMessage(true, 1, 10);
    const expected = "Value must be between 1 and 10";
    expect(result).toEqual(expected);

    result = getErrorMessage(false, 1, 10);
    expect(result).toEqual(null);
  });

  it("renders LimitLabel subcomponent", () => {
    props = {
      label: "test",
      available: 5,
      unit: "GB"
    };
    wrapper = shallow(<LimitLabel {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("getDerivedStateFromProps", () => {
    let nextProps = { mem: 3, proc: 2 };
    let prevState = { mem: 1, proc: 2 };
    let result = Resources.getDerivedStateFromProps(nextProps, prevState);
    let expected = { errorMem: false };
    expect(result).toEqual(expected);

    nextProps = { mem: 1, proc: 4 };
    prevState = { mem: 1, proc: 2 };
    result = Resources.getDerivedStateFromProps(nextProps, prevState);
    expected = { errorProc: false };
    expect(result).toEqual(expected);

    nextProps = { mem: 1, proc: 2 };
    prevState = { mem: 1, proc: 2 };
    result = Resources.getDerivedStateFromProps(nextProps, prevState);
    expect(result).toEqual(null);
  });

  describe("componentDidUpdate", () => {
    it("Update entry values whose server default values exceed resource maximums", () => {
      props = {
        onGet: jest.fn(),
        onUpdate: sinon.spy(),
        maxMem: 10,
        maxProc: 10
      };
      wrapper = shallow(<Resources {...props} />);

      wrapper.setProps({ overResourceMax: { test_proc: 100, test_mem: 100 } });
      expect(props.onUpdate.calledWith({ name: "test_proc", value: 10 })).toBe(
        true
      );
    });

    it("Update entry values whose values exceed resource maximums", () => {
      props = {
        onGet: jest.fn(),
        onUpdate: sinon.spy(),
        overResourceMax: { test_mem: 100 },
        maxMem: 10,
        maxProc: 10,
        proc: 1,
        mem: 30
      };
      wrapper = shallow(<Resources {...props} />);
      wrapper.setProps({ overResourceMax: {} });
      expect(props.onUpdate.calledWith({ name: "mem", value: 10 })).toBe(true);

      wrapper.setProps({ overResourceMax: { foo: "bar" } });
      wrapper.setState({ mem: 1, proc: 30 });

      wrapper.setProps({ overResourceMax: {} });
      expect(props.onUpdate.calledWith({ name: "proc", value: 10 })).toBe(true);
    });
  });

  it("renders Resources component and calls onGet prop on mount", () => {
    props = {
      onGet: jest.fn(),
      proc: 3,
      mem: 5,
      minProc: 1,
      mimMem: 1,
      maxProc: 8,
      maxMem: 10,
      resources: {
        mem: { total: 1000, available: 500 },
        proc: [10, 15, 20]
      },
      error: "",
      overResourceMax: {}
    };
    wrapper = shallow(<Resources {...props} />);

    expect(wrapper).toMatchSnapshot();
    expect(props.onGet).toHaveBeenCalled();
  });

  it("renders a <LoadingPlaceholder /> component when resources data are not yet fetched", () => {
    wrapper = shallow(<Resources onGet={jest.fn()} resources={null} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders an alert if the error props is set", () => {
    wrapper = shallow(<Resources onGet={jest.fn()} error="test-error" />);
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.find(Alert).exists()).toBe(true);
  });

  it("calls setError when input is invalid", () => {
    const mockEvent = {
      preventDefault: jest.fn(),
      target: { name: "test", value: 0 }
    };

    wrapper = mount(<Resources onGet={jest.fn()} />);
    wrapper
      .find(InputError)
      .at(0)
      .prop("onInvalid")(mockEvent);

    expect(wrapper.state("errorTest")).toBe(true);
  });

  describe("dispatch functions", () => {
    let spy;
    let mockEvent;

    afterEach(() => {
      spy.restore();
    });

    it("calls updateSetting() on input submit", () => {
      spy = sinon.spy(actions, "updateSetting");
      expect(spy.called).toBe(false);

      wrapper = mount(<ResourcesContainer store={store} />);

      mockEvent = {
        name: "test",
        value: 5,
        max: 10,
        min: 1
      };

      wrapper
        .find(InputError)
        .at(0)
        .prop("onSave")({ ...mockEvent, value: 100 });
      expect(spy.called).toBe(false);

      wrapper
        .find(InputError)
        .at(0)
        .prop("onSave")(mockEvent);
      expect(spy.calledWith("test", 5)).toBe(true);
    });

    it("calls getResources() on componentDidMount", () => {
      spy = sinon.spy(jobActions, "getResources");
      expect(spy.called).toBe(false);

      wrapper = mount(<ResourcesContainer store={store} />);

      expect(spy.calledOnce).toBe(true);
    });

    it("calls clearError() to clear error in state and in store on input change", () => {
      spy = sinon.spy(errorActions, "clearError");
      expect(spy.called).toBe(false);

      wrapper = mount(<ResourcesContainer store={store} />);

      mockEvent = {
        preventDefault: jest.fn(),
        target: { name: "test" }
      };
      wrapper
        .find(InputError)
        .at(0)
        .prop("onChange")(mockEvent);

      expect(spy.calledWith("UPDATE_SETTINGS_ERROR")).toBe(true);
    });
  });
});

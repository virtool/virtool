import { ListGroupItem } from "../../base/index";
import CreateAnalysis, { IndexSelect } from "./Create";

describe("<CreateAnalysis />", () => {
  let props;
  let wrapper;

  beforeEach(() => {
    props = {
      show: true,
      samples: null,
      id: "123abc",
      hasHmm: false,
      refIndexes: [],
      selected: [],
      userId: "test-user",
      onSubmit: sinon.spy(),
      onHide: sinon.spy()
    };
  });

  it("renders correctly", () => {
    wrapper = shallow(<CreateAnalysis {...props} />);
    expect(wrapper).toMatchSnapshot();

    wrapper.setState({ selected: [{ id: "test1" }, { id: "test2" }] });
    expect(wrapper.find({ style: { float: "left" } })).toMatchSnapshot();

    wrapper.setProps({ samples: ["test", "example"] });
    expect(wrapper.find({ style: { float: "left" } })).toMatchSnapshot();

    wrapper.setProps({ samples: ["test"] });
    wrapper.setState({ selected: [{ id: "test" }] });
    expect(wrapper.find({ style: { float: "left" } })).toMatchSnapshot();
  });

  it("Input change of algorithm sets component state", () => {
    const mockEvent = { target: { value: "nuvs" } };

    wrapper = shallow(<CreateAnalysis {...props} />);
    expect(wrapper.state("algorithm")).toEqual("pathoscope_bowtie");

    wrapper.find({ value: "pathoscope_bowtie" }).prop("onChange")(mockEvent);
    expect(wrapper.state("algorithm")).toEqual(mockEvent.target.value);
  });

  it("Selecting index entries sets component state", () => {
    const newEntry = { id: "target" };

    wrapper = shallow(<CreateAnalysis {...props} />);
    wrapper.setState({ selected: [{ id: "target" }] });
    wrapper.find({ indexes: props.refIndexes }).prop("onSelect")(newEntry);
    expect(wrapper.state("selected")).toEqual([]);

    wrapper.find({ indexes: props.refIndexes }).prop("onSelect")(newEntry);
    expect(wrapper.state("selected")).toEqual([newEntry]);
  });

  it("Closing modal resets to initial component state", () => {
    wrapper = shallow(<CreateAnalysis {...props} />);
    wrapper.setState({ algorithm: "nuvs" });

    wrapper.prop("onExited")();
    expect(wrapper.state("algorithm")).toEqual("pathoscope_bowtie");
  });

  it("Clicking Start button calls onSubmit callback and closes modal", () => {
    expect(props.onSubmit.called).toBe(false);
    expect(props.onHide.called).toBe(false);

    wrapper = shallow(<CreateAnalysis {...props} />);
    wrapper.find("form").prop("onSubmit")({ preventDefault: jest.fn() });
    expect(wrapper.state("errorRef")).toEqual("Please select reference(s)");

    wrapper.setState({ selected: [{ id: "test" }] });
    wrapper.find("form").prop("onSubmit")({ preventDefault: jest.fn() });
    expect(
      props.onSubmit.calledWith(
        props.id,
        [{ id: "test" }],
        "pathoscope_bowtie",
        props.userId
      )
    ).toBe(true);
    expect(props.onHide.calledOnce).toBe(true);
  });

  describe("renders <IndexSelect /> subcomponent", () => {
    beforeEach(() => {
      props = {
        indexes: [
          {
            id: "index0",
            reference: { id: "123abc", name: "test-ref" },
            version: 0
          }
        ],
        onSelect: sinon.spy(),
        selected: [],
        error: "Test Error"
      };
    });

    it("displays error message and styling and index list", () => {
      wrapper = shallow(<IndexSelect {...props} />);
      expect(wrapper).toMatchSnapshot();
    });

    it("displays <NoneFound /> when no indexes provided", () => {
      props = { ...props, indexes: [], error: "" };
      wrapper = shallow(<IndexSelect {...props} />);
      expect(wrapper).toMatchSnapshot();
    });

    it("calls onSelect callback when index entry is clicked", () => {
      expect(props.onSelect.called).toBe(false);

      wrapper = shallow(<IndexSelect {...props} />);
      wrapper.find(ListGroupItem).prop("onClick")();

      expect(props.onSelect.calledWith({ id: "index0", refId: "123abc" })).toBe(
        true
      );
    });
  });
});

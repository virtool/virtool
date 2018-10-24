import OTUIssues from "./Issues";

describe("<OTUIssues />", () => {
  let props;
  let wrapper;

  it("renders correctly without issues", () => {
    props = {
      issues: {
        empty_otu: false,
        isolate_inconsistency: false,
        empty_isolate: false,
        empty_sequence: false
      },
      isolates: []
    };
    wrapper = shallow(<OTUIssues {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders correctly with issues", () => {
    props = {
      issues: {
        empty_otu: true,
        isolate_inconsistency: true,
        empty_isolate: ["test-isolate"],
        empty_sequence: [
          {
            _id: "test-sequence",
            isolate_id: "test-isolate"
          }
        ]
      },
      isolates: [
        {
          id: "test-isolate",
          source_type: "isolate",
          source_name: "test"
        }
      ]
    };
    wrapper = shallow(<OTUIssues {...props} />);
    expect(wrapper).toMatchSnapshot();
  });
});

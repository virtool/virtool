import { ClipLoader } from "halogenium";
import { LoadingPlaceholder } from "./LoadingPlaceholder";

describe("<LoadingPlaceholder />", () => {
  let props;
  let wrapper;

  it("renders correctly", () => {
    wrapper = shallow(<LoadingPlaceholder />);

    expect(wrapper).toMatchSnapshot();
  });

  it("displays provided message and margin", () => {
    props = {
      margin: "300px",
      message: "Test Message"
    };
    wrapper = shallow(<LoadingPlaceholder {...props} />);

    expect(wrapper.find("div").prop("style")).toEqual({
      marginTop: props.margin
    });
    expect(wrapper.find("p").text()).toEqual(props.message);
    expect(wrapper).toMatchSnapshot();
  });

  it("displays ClipLoader spinner and passes it supplied color & size props", () => {
    props = {
      color: "blue",
      size: "30px"
    };
    wrapper = shallow(<LoadingPlaceholder {...props} />);

    expect(wrapper.find(ClipLoader).length).toEqual(1);
    expect(wrapper.find(ClipLoader).prop("color")).toEqual(props.color);
    expect(wrapper.find(ClipLoader).prop("size")).toEqual(props.size);
    expect(wrapper.find(ClipLoader)).toMatchSnapshot();
  });
});

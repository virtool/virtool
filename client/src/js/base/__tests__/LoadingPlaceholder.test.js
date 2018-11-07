import { LoadingPlaceholder } from "../LoadingPlaceholder";

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
});

import JobSteps from "../Steps";

describe("<JobSteps />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            steps: ["one", "two", "three"]
        };
        wrapper = shallow(<JobSteps {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

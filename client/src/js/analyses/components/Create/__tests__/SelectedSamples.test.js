import { SelectedSamples } from "../SelectedSamples.js";

describe("<SelectedSamples />", () => {
    let props;

    beforeEach(() => {
        props = {
            samples: [{ id: "foo", name: "bar" }]
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SelectedSamples {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should return when [samples.length=0]", () => {
        props.samples = [];
        const wrapper = shallow(<SelectedSamples {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

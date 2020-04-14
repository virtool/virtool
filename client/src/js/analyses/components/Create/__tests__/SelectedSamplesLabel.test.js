import { SelectedSamplesLabel } from "../SelectedSamplesLabel";

describe("<SelectedSamplesLabel />", () => {
    let props;

    beforeEach(() => {
        props = {
            count: 1
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SelectedSamplesLabel {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should return when [count>1]", () => {
        props.count = 2;
        const wrapper = shallow(<SelectedSamplesLabel {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

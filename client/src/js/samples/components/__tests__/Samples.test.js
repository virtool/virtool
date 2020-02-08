import Samples, { SampleFileManager } from "../Samples";

describe("<SampleFileManager />", () => {
    it("should render", () => {
        const wrapper = shallow(<SampleFileManager />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<Samples />", () => {
    it("should render", () => {
        const wrapper = shallow(<Samples />);
        expect(wrapper).toMatchSnapshot();
    });
});

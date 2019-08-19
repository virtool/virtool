import Samples, { SampleFileManager, SampleSettings } from "../Samples";

describe("<SampleFileManager />", () => {
    it("should render", () => {
        const wrapper = shallow(<SampleFileManager />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<SamplesSettings />", () => {
    it("should render", () => {
        const wrapper = shallow(<SampleSettings />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<Samples />", () => {
    it("should render", () => {
        const wrapper = shallow(<Samples />);
        expect(wrapper).toMatchSnapshot();
    });
});

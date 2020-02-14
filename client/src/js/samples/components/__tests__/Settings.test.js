import { SamplesSettings } from "../Settings";

describe("<SamplesSettings />", () => {
    it.each([true, false])("should render when [loading=%p]", loading => {
        const wrapper = shallow(<SamplesSettings loading={loading} />);
        expect(wrapper).toMatchSnapshot();
    });
});

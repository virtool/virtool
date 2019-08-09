import { Settings } from "../Settings";

describe("<Settings />", () => {
    it.each([true, false])("should render when [props.loading=%p]", loading => {
        const wrapper = shallow(<Settings loading={loading} />);
        expect(wrapper).toMatchSnapshot();
    });
});

import { DataTypeSelection } from "../DataTypeSelection";

describe("<DataTypeSelection />", () => {
    const props = {
        onSelect: jest.fn(),
        dataType: "genome"
    };
    it("should render", () => {
        const wrapper = shallow(<DataTypeSelection {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

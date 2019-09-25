import { BLASTError } from "../BLASTError";

describe("<BLASTError />", () => {
    let props;
    let wrapper;

    beforeEach(() => {
        props = {
            error: "Failure. BLAST did not work.",
            onBlast: jest.fn()
        };
        wrapper = shallow(<BLASTError {...props} />);
    });

    it("should render", () => {
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onBlast when retry link clicked", () => {
        wrapper.find("a").simulate("click");
        expect(props.onBlast).toHaveBeenCalled();
    });
});

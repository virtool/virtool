import { AnalysisItemRightIcon } from "../RightIcon";

describe("<RightIcon />", () => {
    let props;

    beforeEach(() => {
        props = {
            canModify: false,
            ready: true,
            onRemove: jest.fn()
        };
    });

    it("should render remove icon when [ready=true] and [canModify=true]", () => {
        props.canModify = true;
        const wrapper = shallow(<AnalysisItemRightIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should return null when [ready=true] and [canModify=false]", () => {
        const wrapper = shallow(<AnalysisItemRightIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render loader when [ready=false]", () => {
        props.ready = false;
        const wrapper = shallow(<AnalysisItemRightIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onRemove() when remove icon is clicked", () => {
        props.canModify = true;
        const wrapper = shallow(<AnalysisItemRightIcon {...props} />);
        wrapper.find("Icon").simulate("click");
        expect(props.onRemove).toHaveBeenCalled();
    });
});

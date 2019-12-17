import { JobAction } from "../Action";

describe("<JobActionIcon />", () => {
    let props;

    beforeEach(() => {
        props = {
            state: "waiting",
            canCancel: true,
            canRemove: true,
            onCancel: jest.fn(),
            onRemove: jest.fn()
        };
    });

    it.each(["waiting", "running", "cancelled", "error", "complete"])("should render when [state=%p]", state => {
        props.state = state;
        const wrapper = shallow(<JobAction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it('should render when [state="waiting"] and [canCancel=false]', () => {
        props.canCancel = false;
        const wrapper = shallow(<JobAction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it('should render when [state="complete"] and [canRemove=false]', () => {
        props.state = "complete";
        props.canRemove = false;
        const wrapper = shallow(<JobAction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onCancel() when cancel icon clicked", () => {
        const wrapper = shallow(<JobAction {...props} />);
        wrapper.find("Icon").prop("onClick")();
        expect(props.onCancel).toHaveBeenCalled();
    });

    it("should call onRemove() when remove icon clicked", () => {
        props.state = "complete";
        const wrapper = shallow(<JobAction {...props} />);
        wrapper.find("Icon").prop("onClick")();
        expect(props.onRemove).toHaveBeenCalled();
    });
});

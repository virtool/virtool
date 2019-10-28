import { JobActionIcon, JobStatusIcon } from "../Icons";

describe("<JobActionIcon />", () => {
    let props;

    beforeEach(() => {
        props = {
            state: "waiting",
            canCancel: true,
            onCancel: jest.fn(),
            canRemove: true,
            onRemove: jest.fn()
        };
    });

    it("should render when[state='waiting' && canCancel=true]", () => {
        const wrapper = shallow(<JobActionIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when[state='runing' && canCancel=true]", () => {
        props.state = "runing";
        const wrapper = shallow(<JobActionIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when[canCancel=false && canRemove=true]", () => {
        props.canCancel = false;
        const wrapper = shallow(<JobActionIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when[canCancel=false && canRemove=false]", () => {
        props.canCancel = false;
        props.canRemove = false;
        const wrapper = shallow(<JobActionIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<JobStatusIcon />", () => {
    let props;

    beforeEach(() => {
        props = {
            state: "waiting"
        };
    });

    it("should render when[state='waiting']", () => {
        const wrapper = shallow(<JobStatusIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when[state='running']", () => {
        const wrapper = shallow(<JobStatusIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when[state='complete']", () => {
        const wrapper = shallow(<JobStatusIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when[state='error']", () => {
        const wrapper = shallow(<JobStatusIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when[state='cancelled']", () => {
        const wrapper = shallow(<JobStatusIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

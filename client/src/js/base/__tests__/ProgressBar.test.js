import { ProgressBar, AutoProgressBar } from "../ProgressBar";

describe("<AutoProgressBar />", () => {
    let props;
    let state;

    beforeEach(() => {
        props = {
            step: 1,
            bsStyle: "danger",
            active: true,
            interval: 2,
            affixed: true
        };
        state = {
            fill: 0,
            active: true
        };
    });

    it("should render when [this.state.fill=0]", () => {
        const wrapper = shallow(<AutoProgressBar {...props} />);
        wrapper.setState({ fill: 0 });
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [this.state.fill!=0]", () => {
        const wrapper = shallow(<AutoProgressBar {...props} />);
        wrapper.setState({ ...state, fill: 1 });
        expect(wrapper).toMatchSnapshot();
    });

    it("componentDidUpdate() should update this.interval when [this.state.fill !== prevState.fill] and [this.state.fill === 10]", () => {
        const wrapper = shallow(<AutoProgressBar {...props} />);
        wrapper.setState({ ...state, fill: 10 });
        wrapper.setProps({ ...props, interval: 10000 });
        expect(wrapper.instance().interval).toBe(10);
    });

    it("componentDidUpdate() should call window.clearInterval when [this.props.active=false && prevState.active=true]", () => {
        const wrapper = shallow(<AutoProgressBar {...props} />);
        wrapper.instance().interval = 1;
        window.clearInterval = jest.fn();
        wrapper.setProps({ props, active: false });
        expect(window.clearInterval).toHaveBeenCalledWith(1);
    });

    it("componentWillUnmount() should call window.clearInterval when component unmount", () => {
        const wrapper = mount(<AutoProgressBar {...props} />);
        wrapper.instance().interval = 1;
        window.clearInterval = jest.fn();
        wrapper.unmount();
        expect(window.clearInterval).toHaveBeenCalledWith(1);
    });
});

describe("<ProgressBar />", () => {
    let props;

    beforeEach(() => {
        props = {
            now: 1,
            onMoved: jest.fn(),
            children: "foo",
            affixed: true,
            styled: { foo: "bar" },
            bsStyle: "danger"
        };
    });

    it("should render", () => {
        const wrapper = shallow(<ProgressBar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("componentDidUpdate() should call addEventListener when [prevProps.now !== this.props.now]", () => {
        const wrapper = shallow(<ProgressBar {...props} />);
        const addEventListener = jest.fn();
        wrapper.instance().barNode = {
            addEventListener
        };
        wrapper.setProps({ now: 2 });
        expect(addEventListener).toHaveBeenCalled();
    });

    it("componentWillUnmount() should call removeEventListener when component unmount", () => {
        const wrapper = shallow(<ProgressBar {...props} />);
        const removeEventListener = jest.fn();
        wrapper.instance().barNode = {
            removeEventListener
        };
        wrapper.unmount();
        expect(removeEventListener).toHaveBeenCalled();
    });
});

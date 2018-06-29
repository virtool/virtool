import { ProgressBar, AutoProgressBar } from "./ProgressBar";

describe("<ProgressBar />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<ProgressBar />);

        expect(wrapper).toMatchSnapshot();
    });

    it("applies given css properties to elements", () => {
        props = {
            affixed: true,
            style: { paddingTop: "100px" },
            bsStyle: "danger"
        };
        wrapper = shallow(<ProgressBar {...props} />);

        expect(wrapper.find('div').at(0).hasClass("progress progress-affixed")).toBe(true);
        expect(wrapper.find('div').at(0).prop('style')).toEqual(props.style);
        expect(wrapper.find('div').at(1).hasClass(`progress-bar progress-bar-${props.bsStyle}`)).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <div>, child <div> and optional children", () => {
        props = {
            children: <div id="test-child" />
        };
        wrapper = shallow(<ProgressBar {...props} />);

        expect(wrapper.find('div').length).toEqual(3);
        expect(wrapper.is('div')).toBe(true);
        expect(wrapper.childAt(0).is('div')).toBe(true);
        expect(wrapper.find('#test-child').exists()).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });

    it("calls onTransitionend() when props.now changes", () => {
        // Calls callback onMoved function if it exists
        props = {
            onMoved: jest.fn()
        };
        wrapper = mount(<ProgressBar {...props} />);
        wrapper.instance().onTransitionend();
        expect(props.onMoved).toHaveBeenCalled();

        // Does not call onMoved callback if it is not provided
        props = {
            now: 10
        };
        wrapper = mount(<ProgressBar {...props} />);
        const spy = sinon.spy(wrapper.instance(), "onTransitionend");

        const update = {
            now: 50
        };
        wrapper.setProps(update);
        wrapper.instance().onTransitionend();
        expect(spy.calledOnce).toBe(true);

        spy.restore();
    });

    it("removes custom eventListener in componentWillUnmount", () => {
        const spyCWU = sinon.spy(ProgressBar.prototype, "componentWillUnmount");
        wrapper = mount(<ProgressBar />);
        const spyRemoveListener = sinon.spy(wrapper.find('div').at(1).instance(), "removeEventListener");

        expect(spyCWU.called).toBe(false);
        expect(spyRemoveListener.called).toBe(false);

        wrapper.unmount();

        expect(spyCWU.calledOnce).toBe(true);
        expect(spyRemoveListener.calledOnce).toBe(true);

        spyRemoveListener.restore();
        spyCWU.restore();
    });

    describe("<AutoProgressBar />", () => {

        it("renders correctly", () => {
            wrapper = shallow(<AutoProgressBar />);

            expect(wrapper).toMatchSnapshot();
        });

        it("renders a ProgressBar component if [state.fill>0], <div> otherwise", () => {
            wrapper = shallow(<AutoProgressBar />);

            expect(wrapper.find(ProgressBar).length).toEqual(0);
            expect(wrapper.find('div').hasClass("progress-affixed-empty")).toBe(true);

            wrapper.setState({ fill: 10 });

            expect(wrapper.find(ProgressBar).length).toEqual(1);
            expect(wrapper.find(".progress-affixed-empty").length).toEqual(0);
        });

        it("should call stop() when component unmounts via componentWillUnmount", () => {
            const spyCWU = sinon.spy(AutoProgressBar.prototype, "componentWillUnmount");
            const spyClearInterval = sinon.spy(window, "clearInterval");
            wrapper = shallow(<AutoProgressBar />);

            expect(spyCWU.called).toBe(false);
            expect(spyClearInterval.called).toBe(false);

            wrapper.unmount();

            expect(spyCWU.calledOnce).toBe(true);
            expect(spyClearInterval.calledOnce).toBe(true);

            spyCWU.restore();
            spyClearInterval.restore();
        });

        it("onMove handler should reset fill state if [now=100]", () => {
            // now !== 100 so handleMoved does not execute anything
            wrapper = mount(<AutoProgressBar />);
            wrapper.setState({ fill: 25 });

            wrapper.instance().handleMoved(50);
            expect(wrapper.state('fill')).toEqual(25);

            // props.now === 100 therefore should reset state.fill to 0
            wrapper.instance().handleMoved(100);
            expect(wrapper.state('fill')).toEqual(0);
        });

        describe("move()", () => {
            const stubMath = sinon.stub(Math, "random").returns(1);
            props = {
                step: 4
            };
            wrapper = mount(<AutoProgressBar {...props} />);
            const spyStop = sinon.spy(wrapper.instance(), "stop");

            // If fill < 80, set state to fill value
            wrapper.setState({ fill: 10 });
            wrapper.instance().move();
            expect(spyStop.called).toBe(false);
            expect(wrapper.state('fill')).toEqual(14);

            // If fill >= 90, call stop()
            wrapper.setState({ fill: 80 });
            wrapper.instance().move();
            expect(spyStop.calledOnce).toBe(true);

            stubMath.restore();
            spyStop.restore();
        });

    });
});

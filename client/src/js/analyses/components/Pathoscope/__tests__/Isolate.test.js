import { PathoscopeIsolate, PathoscopeIsolateWeight } from "../Isolate";

describe("<PathoscopeIsolate />", () => {
    let props;

    beforeEach(() => {
        props = {
            depth: 13,
            maxDepth: 22,
            name: "Isolate A",
            pi: 0.712,
            sequences: [
                { filled: [1, 2, 3, 4, 5], length: 5, id: "foo", definition: "Foo Hit" },
                { filled: [1, 2, 3, 4, 5, 4, 2, 3], length: 8, id: "bar", definition: "Bar Hit" }
            ],
            reads: 102,
            showPathoscopeReads: false
        };
    });

    it("should render", () => {
        const wrapper = shallow(<PathoscopeIsolate {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render read count", () => {
        props.showPathoscopeReads = true;
        const wrapper = shallow(<PathoscopeIsolate {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<PathoscopeIsolateWeight />", () => {
    let props;

    beforeEach(() => {
        props = { pi: 0.321, reads: 121, showReads: false };
    });

    it("should render weight", () => {
        const wrapper = shallow(<PathoscopeIsolateWeight {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render weight in scientific notation", () => {
        props.pi = 0.000000321;
        const wrapper = shallow(<PathoscopeIsolateWeight {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render reads", () => {
        props.showPathoscopeReads = true;
        const wrapper = shallow(<PathoscopeIsolateWeight {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

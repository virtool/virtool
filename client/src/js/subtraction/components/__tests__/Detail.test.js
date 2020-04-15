import { SubtractionDetail } from "../Detail";

describe("<SubtractionDetail />", () => {
    let props;

    beforeEach(() => {
        props = {
            match: { params: { subtractionId: "test" } },
            detail: {
                id: "foo",
                name: "Foo",
                ready: true,
                linked_samples: [
                    { id: "bar", name: "Bar" },
                    { id: "baz", name: "Baz" }
                ],
                file: { id: "123-Foo.fa.gz", name: "Foo.fa.gz" },
                gc: { a: 0.2, t: 0.2, g: 0.2, c: 0.2, n: 0.2 },
                nickname: "foo-nickname"
            },
            canModify: true,
            error: "",
            onGet: jest.fn(),
            onShowRemove: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SubtractionDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render loading when [detail=null]", () => {
        props.detail = null;
        const wrapper = shallow(<SubtractionDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render not found on request error", () => {
        props.detail = null;
        props.error = "Not found";
        const wrapper = shallow(<SubtractionDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render pending message when subtraction is not ready", () => {
        props.detail.ready = false;
        const wrapper = shallow(<SubtractionDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should not render icons when [canModify=false]", () => {
        props.canModify = false;
        const wrapper = shallow(<SubtractionDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render file id when name not defined", () => {
        delete props.detail.file.name;
        const wrapper = shallow(<SubtractionDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

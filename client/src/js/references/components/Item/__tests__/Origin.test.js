import { ReferenceItemOrigin } from "../Origin";

describe("<ReferenceItemOrigin />", () => {
    let props;

    beforeEach(() => {
        props = {
            clonedFrom: undefined,
            importedFrom: undefined,
            remotesFrom: undefined
        };
    });

    it("should render for cloned references", () => {
        props.clonedFrom = {
            id: "foo",
            name: "Foo"
        };
        const wrapper = shallow(<ReferenceItemOrigin {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render for imported references", () => {
        props.importedFrom = {
            id: "bar",
            name: "Bar"
        };
        const wrapper = shallow(<ReferenceItemOrigin {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render for remoted references", () => {
        props.remotesFrom = {
            id: "baz",
            name: "Baz"
        };
        const wrapper = shallow(<ReferenceItemOrigin {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

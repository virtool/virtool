import { IndexSelector } from "../Create/IndexSelector.js";

describe("<IndexSelector />", () => {
    let props;

    beforeEach(() => {
        props = {
            indexes: [{ id: "foo" }, { id: "bar" }],
            onSelect: "foo",
            selected: [{ id: "foo" }, { id: "bar" }],
            error: ["foo"]
        };
    });

    it("should render", () => {
        const wrapper = shallow(<IndexSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

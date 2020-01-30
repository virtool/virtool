import { mapStateToProps, mapDispatchToProps, Targets, StyledAddTargetsButton } from "../Targets";

describe("<Targets />", () => {
    const props = {
        targets: [{ name: "foo" }],
        onRemove: jest.fn(),
        refId: "bar"
    };

    it("should render", () => {
        const wrapper = shallow(<Targets {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("add() should update state", () => {
        const wrapper = shallow(<Targets {...props} />);
        wrapper.find(StyledAddTargetsButton).simulate("click");
        expect(wrapper.state()).toEqual({ showAdd: true, showEdit: false });
    });

    it("edit() should update state", () => {
        const wrapper = shallow(<Targets {...props} />);
        wrapper.find("TargetItem").simulate("edit");
        expect(wrapper.state()).toEqual({
            activeName: "foo",
            showAdd: false,
            showEdit: true
        });
    });

    it("handleRemove() should call onRemove()", () => {
        const wrapper = shallow(<Targets {...props} />);
        wrapper.find("TargetItem").simulate("remove");
        expect(props.onRemove).toHaveBeenCalledWith("bar", { targets: [] });
    });
});

describe("mapStateToProps()", () => {
    const state = {
        references: {
            detail: {
                id: "baz",
                targets: [
                    { name: "foo", description: "bar", required: false },
                    { name: "Foo", description: "Bar", required: true }
                ]
            }
        }
    };
    it("should return props", () => {
        const result = mapStateToProps(state);
        expect(result).toEqual({
            0: { name: "foo", description: "bar", required: false },
            1: { name: "Foo", description: "Bar", required: true },

            refId: "baz",
            targets: [
                { name: "foo", description: "bar", required: false },
                { name: "Foo", description: "Bar", required: true }
            ]
        });
    });
});

describe("mapDispatchToProps()", () => {
    it("should return onRemove in props ", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onRemove("foo", "bar");
        expect(dispatch).toHaveBeenCalledWith({ refId: "foo", update: "bar", type: "EDIT_REFERENCE_REQUESTED" });
    });
});

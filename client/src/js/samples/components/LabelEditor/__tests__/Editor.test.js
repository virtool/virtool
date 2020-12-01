import { mapDispatchToProps, mapStateToProps } from "../LabelEditor";
import { EditLabel } from "../EditLabel";
import { CreateLabel } from "../CreateLabel";
import { ColorSelector } from "../ColorSelector";

describe("<EditLabel>", () => {
    it("should render", () => {
        const wrapper = shallow(<EditLabel />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<CreateLabel>", () => {
    it("should render", () => {
        const wrapper = shallow(<CreateLabel />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<ColorSelector>", () => {
    it("should render", () => {
        const wrapper = shallow(<ColorSelector />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapDispatchToProps()", () => {
    const dispatch = jest.fn();
    const props = mapDispatchToProps(dispatch);

    it("should return onLoadLabels() in props", () => {
        props.onLoadLabels();
        expect(dispatch).toHaveBeenCalledWith({ type: "GET_LABELS_REQUESTED" });
    });

    it("should return submitNewLabel() in props", () => {
        props.submitNewLabel("Label 2", "BarFoo", "#FFFFFF");
        expect(dispatch).toHaveBeenCalledWith({
            type: "CREATE_LABEL_REQUESTED",
            name: "Label 2",
            description: "BarFoo",
            color: "#FFFFFF"
        });
    });

    it("should return removeLabel() in props", () => {
        props.removeLabel("UniqueID");
        expect(dispatch).toHaveBeenCalledWith({
            type: "REMOVE_LABEL_REQUESTED",
            labelId: "UniqueID"
        });
    });

    it("should return updateLabel() in props", () => {
        props.updateLabel("UniqueID", "Label 3", "FooFoo", "#ABCDEF");
        expect(dispatch).toHaveBeenCalledWith({
            type: "UPDATE_LABEL_REQUESTED",
            labelId: "UniqueID",
            name: "Label 3",
            description: "FooFoo",
            color: "#ABCDEF"
        });
    });
});

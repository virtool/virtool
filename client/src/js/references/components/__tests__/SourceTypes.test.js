import { EDIT_REFERENCE, UPDATE_SETTINGS } from "../../../app/actionTypes";
import { Icon } from "../../../base/index";
import { mapDispatchToProps, SourceTypes, SourceTypeItem } from "../SourceTypes";

describe("<SourceTypes />", () => {
    let props;

    beforeEach(() => {
        props = {
            global: true,
            refId: "foo",
            remote: false,
            restrictSourceTypes: true,
            sourceTypes: ["isolate", "serotype"],
            onUpdate: jest.fn(),
            onToggle: jest.fn()
        };
    });

    it("should render when global", () => {
        const wrapper = shallow(<SourceTypes {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when remote", () => {
        props.global = false;
        props.remote = true;
        const wrapper = shallow(<SourceTypes {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when neither", () => {
        props.global = false;
        props.isRemote = false;
        const wrapper = shallow(<SourceTypes {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onUpdate() when onRemove() called", () => {
        const wrapper = shallow(<SourceTypes {...props} />);
        wrapper.instance().handleRemove("serotype");
        expect(props.onUpdate).toHaveBeenCalledWith(["isolate"], true, "foo");
    });

    it("should call onUpdate() when handleSubmit() is called successfully", () => {
        const wrapper = shallow(<SourceTypes {...props} />);

        const mockEvent = { preventDefault: jest.fn() };

        // Won't be called be value is empty.
        wrapper.setState({ value: "" });
        wrapper.instance().handleSubmit(mockEvent);
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(props.onUpdate).not.toHaveBeenCalled();

        wrapper.setState({ value: "Genotype" });
        wrapper.instance().handleSubmit(mockEvent);
        expect(props.onUpdate).toHaveBeenCalledWith(["isolate", "serotype", "genotype"], true, "foo");
        expect(wrapper.state()).toEqual({ value: "", error: null });
    });

    it("should not call onUpdate() when submitted source type already exists", () => {
        const wrapper = shallow(<SourceTypes {...props} />);
        const mockEvent = { preventDefault: jest.fn() };
        wrapper.setState({ value: "Isolate" });
        wrapper.instance().handleSubmit(mockEvent);
        expect(props.onUpdate).not.toHaveBeenCalled();
        expect(wrapper.state("error")).toEqual("Source type already exists");
    });

    it("should not call onUpdate() when submitted source type contains space", () => {
        const wrapper = shallow(<SourceTypes {...props} />);
        const mockEvent = { preventDefault: jest.fn() };
        wrapper.setState({ value: "With Spaces" });
        wrapper.instance().handleSubmit(mockEvent);
        expect(props.onUpdate).not.toHaveBeenCalled();
        expect(wrapper.state("error")).toEqual("Source types may not contain spaces");
    });

    it("should call onToggle() when handleEnable() is called and [restrictSourceTypes=true]", () => {
        const wrapper = shallow(<SourceTypes {...props} />);
        wrapper.instance().handleEnable();
        expect(props.onToggle).toHaveBeenCalledWith("foo", false);
    });

    it("should call onToggle() handleEnable() is called and [restrictSourceTypes=false]", () => {
        props.restrictSourceTypes = false;
        const wrapper = shallow(<SourceTypes {...props} />);
        wrapper.instance().handleEnable();
        expect(props.onToggle).toHaveBeenCalledWith("foo", true);
    });
});

describe("<SourceTypeItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            onRemove: jest.fn(),
            sourceType: "genotype",
            disabled: false
        };
    });

    it("should render when [disabled=false]", () => {
        const wrapper = shallow(<SourceTypeItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [disabled=true]", () => {
        props.disabled = true;
        const wrapper = shallow(<SourceTypeItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onRemove() when remove icon is clicked", () => {
        const wrapper = shallow(<SourceTypeItem {...props} />);
        expect(wrapper.find(Icon).length).toEqual(1);

        wrapper.find(Icon).prop("onClick")();
        expect(props.onRemove).toHaveBeenCalledWith("genotype");
    });
});

describe("mapDispatchToProps", () => {
    let dispatch;
    let props;

    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return onUpdate() in props when global", () => {
        props.onUpdate(["genotype"], true, "foo");
        expect(dispatch).toHaveBeenCalledWith({
            type: UPDATE_SETTINGS.REQUESTED,
            update: {
                default_source_types: ["genotype"]
            }
        });
    });

    it("should return onUpdate() in props when not global", () => {
        props.onUpdate(["genotype"], false, "foo");
        expect(dispatch).toHaveBeenCalledWith({
            type: EDIT_REFERENCE.REQUESTED,
            refId: "foo",
            update: {
                source_types: ["genotype"]
            }
        });
    });

    it("should return onToggle() in props that can be called with false", () => {
        props.onToggle("foo", false);
        expect(dispatch).toHaveBeenCalledWith({
            type: EDIT_REFERENCE.REQUESTED,
            refId: "foo",
            update: {
                restrict_source_types: false
            }
        });
    });

    it("should return onToggle() in props that can be called with true", () => {
        props.onToggle("foo", true);
        expect(dispatch).toHaveBeenCalledWith({
            type: EDIT_REFERENCE.REQUESTED,
            refId: "foo",
            update: {
                restrict_source_types: true
            }
        });
    });
});

import { EDIT_REFERENCE, UPDATE_SETTINGS } from "../../../app/actionTypes";
import { Icon } from "../../../base/index";
import { mapDispatchToProps, SourceTypes, SourceTypeItem } from "../SourceTypes";

describe("<SourceTypes />", () => {
    describe("renders", () => {
        let props;

        beforeEach(() => {
            props = {
                global: true,
                restrictSourceTypes: true,
                refId: "foo",
                sourceTypes: ["isolate", "serotype"],
                remote: false
            };
        });

        it("when global", () => {
            const wrapper = shallow(<SourceTypes {...props} />);
            expect(wrapper).toMatchSnapshot();
        });

        it("when not global and remote", () => {
            props.global = false;
            props.remote = true;
            const wrapper = shallow(<SourceTypes {...props} />);
            expect(wrapper).toMatchSnapshot();
        });

        it("when not global and not remote", () => {
            props.global = false;
            props.isRemote = false;
            const wrapper = shallow(<SourceTypes {...props} />);
            expect(wrapper).toMatchSnapshot();
        });
    });

    describe("has onUpdate()", () => {
        let props;

        beforeEach(() => {
            props = {
                global: true,
                restrictSourceTypes: true,
                refId: "foo",
                sourceTypes: ["isolate", "serotype"],
                remote: false,
                onUpdate: jest.fn(),
                onToggle: jest.fn()
            };
        });

        it("called when remove() is called", () => {
            const wrapper = mount(<SourceTypes {...props} />);
            wrapper.instance().handleRemove("serotype");
            expect(props.onUpdate).toHaveBeenCalledWith(["isolate"], true, "foo");
        });

        it("called when handleSubmit() is called successfully", () => {
            const wrapper = mount(<SourceTypes {...props} />);
            wrapper.setState({ value: "" });

            const mockEvent = { preventDefault: jest.fn() };

            wrapper.instance().handleSubmit(mockEvent);
            expect(mockEvent.preventDefault).toHaveBeenCalled();

            wrapper.setState({ value: "Genotype" });
            wrapper.instance().handleSubmit(mockEvent);
            expect(props.onUpdate).toHaveBeenCalledWith(["isolate", "serotype", "genotype"], true, "foo");
            expect(wrapper.state()).toEqual({ value: "", error: null });
        });

        it("not called when submitted source type already exists", () => {
            const wrapper = mount(<SourceTypes {...props} />);
            const mockEvent = { preventDefault: jest.fn() };
            wrapper.setState({ value: "Isolate" });
            wrapper.instance().handleSubmit(mockEvent);
            expect(wrapper.state("error")).toEqual("Source type already exists.");
        });

        it("not called when submitted source type contains space", () => {
            const wrapper = mount(<SourceTypes {...props} />);
            const mockEvent = { preventDefault: jest.fn() };
            wrapper.setState({ value: "With Spaces" });
            wrapper.instance().handleSubmit(mockEvent);
            expect(wrapper.state("error")).toEqual("Source types may not contain spaces.");
        });
    });

    describe("has onToggle() called", () => {
        let props;

        beforeEach(() => {
            props = {
                global: true,
                restrictSourceTypes: true,
                refId: "foo",
                sourceTypes: ["isolate", "serotype"],
                remote: false,
                onUpdate: jest.fn(),
                onToggle: jest.fn()
            };
        });

        it("when handleEnable() is called and [restrictSourceTypes=true]", () => {
            const wrapper = mount(<SourceTypes {...props} />);
            wrapper.instance().handleEnable();
            expect(props.onToggle).toHaveBeenCalledWith("foo", false);
        });

        it("when handleEnable() is called and [restrictSourceTypes=false]", () => {
            props.restrictSourceTypes = false;
            const wrapper = mount(<SourceTypes {...props} />);
            wrapper.instance().handleEnable();
            expect(props.onToggle).toHaveBeenCalledWith("foo", true);
        });
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

    it("renders when [disabled=false]", () => {
        const wrapper = shallow(<SourceTypeItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders when [disabled=true]", () => {
        props.disabled = true;
        const wrapper = shallow(<SourceTypeItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("calls onRemove when remove icon is clicked", () => {
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

    it("dispatches UPDATE_SETTINGS for onUpdate() when global", () => {
        props.onUpdate(["genotype"], true, "foo");
        expect(dispatch).toHaveBeenCalledWith({
            type: UPDATE_SETTINGS.REQUESTED,
            update: {
                default_source_types: ["genotype"]
            }
        });
    });

    it("dispatches EDIT_REFERENCE for onUpdate() when not global", () => {
        props.onUpdate(["genotype"], false, "foo");
        expect(dispatch).toHaveBeenCalledWith({
            type: EDIT_REFERENCE.REQUESTED,
            refId: "foo",
            update: {
                source_types: ["genotype"]
            }
        });
    });

    it("dispatches EDIT_REFERENCE for onToggle('foo', false)", () => {
        props.onToggle("foo", false);
        expect(dispatch).toHaveBeenCalledWith({
            type: EDIT_REFERENCE.REQUESTED,
            refId: "foo",
            update: {
                restrict_source_types: false
            }
        });
    });

    it("dispatches EDIT_REFERENCE for onToggle('foo', true)", () => {
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

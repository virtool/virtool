import React from "react";
import { CreateSample, mapStateToProps, mapDispatchToProps } from "../Create";

describe("<CreateSample>", () => {
    let props;
    let state;
    let e;
    beforeEach(() => {
        props = {
            subtractions: null,
            readyReads: [],
            forceGroupChoice: false,
            subtractions: [],
            onCreate: jest.fn()
        };
        state = {
            selected: [],
            name: "",
            host: "",
            isolate: "",
            locale: "",
            subtraction: "",
            group: "",
            errorName: "",
            errorSubtraction: "",
            errorFile: "",
            libraryType: ""
        };
        e = {
            preventDefault: jest.fn(),
            target: {
                name: "name",
                value: "foo",
                error: "error"
            }
        };
    });

    it("should render", () => {
        const wrapper = shallow(<CreateSample {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [this.props.subtractions=null]", () => {
        const wrapper = shallow(<CreateSample {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [this.props.subtractions!=null] and [this.props.readyReads!==null]", () => {
        props.subtractions = "foo";
        props.readyReads = [{ foo: "bar" }];
        const wrapper = shallow(<CreateSample {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("handleModalExited() should update state when Modal is exited", () => {
        props.subtractions = ["foo"];
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.find("Modal").simulate("exit");
        expect(wrapper.state()).toEqual({ ...state, subtraction: "foo" });
    });
    it("handleChange() should update state [name] and [error] when InputError is changed and [name=name]", () => {
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper
            .find("InputError")
            .at(0)
            .simulate("change", e);
        expect(wrapper.state()).toEqual({ ...state, name: "foo" });
    });
    it("handleChange() should update [name] when [name!=name] and [name!=subtraction]", () => {
        e.target.name = "Foo";
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper
            .find("InputError")
            .at(0)
            .simulate("change", e);
        expect(wrapper.state()).toEqual({ ...state, Foo: "foo" });
    });
    it("handleLibrarySelect() should update libraryType when LibraryTypeSelection is selected", () => {
        const libraryType = "sRNA";
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper
            .find("LibraryTypeSelection")
            .at(0)
            .simulate("select", libraryType);
        expect(wrapper.state()).toEqual({ ...state, libraryType });
    });

    it("handleSubmit() should update errorName when form is submitted and [this.state.name='']", () => {
        props.subtractions = ["foo"];
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState({ ...state, selected: ["bar"] });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({ ...state, selected: ["bar"], errorName: "Required Field" });
    });
    it("handleSubmit() should update errorSubtraction when form is submitted and [this.props.subtractions=[]]", () => {
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState({ ...state, name: "foo", selected: ["bar"] });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({
            ...state,
            errorSubtraction: "At least one subtraction must be added to Virtool before samples can be analyzed.",
            selected: ["bar"],
            name: "foo"
        });
    });
    it("handleSubmit() should update errorFile when form is submitted and [this.props.selected=[]]", () => {
        props.subtractions = ["foo"];
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState({ ...state, name: "foo" });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({
            ...state,
            errorFile: "At least one read file must be attached to the sample",
            name: "foo"
        });
    });
    it("handleSubmit() should call onCreate when form is submitted and [hasError=false]", () => {
        props.subtractions = ["foo"];
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState({ ...state, name: "foo", selected: ["foo"] });
        wrapper.find("form").simulate("submit", e);
        expect(props.onCreate).toHaveBeenCalledWith({ ...state, name: "foo", selected: ["foo"], files: ["foo"] });
    });

    it("auto fill should update name when Button is clicked", () => {
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState({
            ...state,
            selected: ["foo"]
        });
        wrapper.find("Button").simulate("click");
        expect(wrapper.state()).toEqual({ ...state, name: "foo", selected: ["foo"] });
    });

    it("handleSelect() should update selected selected and errorFile when ReadSelector is selected", () => {
        const selected = ["foo"];
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.find("ReadSelector").simulate("select", selected);
        expect(wrapper.state()).toEqual({ ...state, selected: ["foo"], errorFile: "" });
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            router: { location: { stae: "foo" } },
            settings: {
                sample_group: "force_choice"
            },
            account: { groups: "foo" },
            samples: {
                readFiles: [
                    {
                        foo: "bar",
                        reserved: true
                    },
                    {
                        Foo: "Bar",
                        reserved: false
                    }
                ]
            },
            subtraction: { ids: "bar" }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            error: "",
            forceGroupChoice: true,
            groups: "foo",
            readyReads: [
                {
                    Foo: "Bar",
                    reserved: false
                }
            ],
            show: false,
            subtractions: "bar"
        });
    });
});
describe("mapDispatchToProps()", () => {
    const dispatch = jest.fn();
    const props = mapDispatchToProps(dispatch);
    it("onLoadSubtractionsAndFiles() should return listSubtractionIds in props", () => {
        props.onLoadSubtractionsAndFiles();
        expect(dispatch).toHaveBeenCalledWith({ type: "LIST_SUBTRACTION_IDS_REQUESTED" });
    });
    it("onLoadSubtractionsAndFiles() should return findReadFiles in props", () => {
        props.onLoadSubtractionsAndFiles();
        expect(dispatch).toHaveBeenCalledWith({ type: "FIND_READ_FILES_REQUESTED" });
    });
    it("onCreate() should return createSample in props", () => {
        props.onCreate({
            name: "name",
            isolate: "isolate",
            host: "host",
            locale: "locale",
            libraryType: "libraryType",
            subtraction: "subtraction",
            files: "files"
        });
        expect(dispatch).toHaveBeenCalledWith({
            name: "name",
            isolate: "isolate",
            host: "host",
            locale: "locale",
            libraryType: "libraryType",
            subtraction: "subtraction",
            files: "files",
            type: "CREATE_SAMPLE_REQUESTED"
        });
    });

    it("onHide() should return pushState in props", () => {
        props.onHide();
        expect(dispatch).toHaveBeenCalledWith({ state: { create: false }, type: "PUSH_STATE" });
    });
    it("onClearError() should return clearError in props", () => {
        props.onClearError("foo");
        expect(dispatch).toHaveBeenCalledWith({ error: "foo", type: "CLEAR_ERROR" });
    });
});

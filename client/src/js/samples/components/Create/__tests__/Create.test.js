import React from "react";
import { Input, InputIcon } from "../../../../base";
import { CreateSample, mapDispatchToProps, mapStateToProps } from "../Create";
import { LibraryTypeSelector } from "../LibraryTypeSelector";

describe("<CreateSample>", () => {
    let props;
    let state;
    let e;

    beforeEach(() => {
        props = {
            error: "",
            subtractions: [
                {
                    id: "sub_foo",
                    name: "Sub Foo"
                },
                {
                    id: "sub_bar",
                    name: "Sub Bar"
                }
            ],
            readyReads: [],
            forceGroupChoice: false,
            onCreate: jest.fn(),
            onHide: jest.fn(),
            onLoadSubtractionsAndFiles: jest.fn(),
            history: {
                push: jest.fn()
            }
        };
        state = {
            name: "Sample 1",
            selected: ["abc123-Foo.fq.gz", "789xyz-Bar.fq.gz"],
            host: "Host",
            isolate: "Isolate",
            locale: "Timbuktu",
            subtractionId: "sub_bar",
            group: "technician",
            errorName: "",
            errorSubtraction: "",
            errorFile: "",
            libraryType: "normal"
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

    it("should render LoadingPlaceholder when [this.props.subtractions=null]", () => {
        props.subtractions = null;
        const wrapper = shallow(<CreateSample {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render LoadingPlaceholder when [this.props.readyReads=null]", () => {
        props.readyReads = null;
        const wrapper = shallow(<CreateSample {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("handleChange() should update state [name] and [error] when InputError is changed and [name=name]", () => {
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState(state);
        wrapper.find(Input).at(0).simulate("change", e);
        expect(wrapper.state()).toEqual({ ...state, name: "foo" });
    });

    it("handleChange() should update [name] when [name='isolate']", () => {
        e.target.name = "isolate";
        e.target.value = "Foo Isolate";

        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState(state);
        wrapper.find(Input).at(0).simulate("change", e);

        expect(wrapper.state()).toEqual({ ...state, isolate: "Foo Isolate" });
    });

    it("handleLibrarySelect() should update libraryType when LibraryTypeSelector is selected", () => {
        const libraryType = "srna";
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState(state);
        wrapper.find(LibraryTypeSelector).at(0).simulate("select", libraryType);
        expect(wrapper.state()).toEqual({ ...state, libraryType });
    });

    it("should display error when form submitted with no name", () => {
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState({ ...state, name: "" });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({ ...state, name: "", errorName: "Required Field" });
        expect(wrapper).toMatchSnapshot();
    });

    it("should display error when form submitted with no subtractions available", () => {
        props.subtractions = [];
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState({ ...state, selected: ["foo"] });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper).toMatchSnapshot();
    });

    it("handleSubmit() should update errorFile when form is submitted and [this.props.selected=[]]", () => {
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState({
            ...state,
            selected: []
        });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({
            ...state,
            selected: [],
            errorFile: "At least one read file must be attached to the sample"
        });
    });

    it("should call onCreate() when form is submitted and [hasError=false]", () => {
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState({ ...state, selected: ["foo"] });
        wrapper.find("form").simulate("submit", e);

        expect(props.onCreate).toHaveBeenCalledWith("Sample 1", "Isolate", "Host", "Timbuktu", "normal", "sub_bar", [
            "foo"
        ]);
    });

    it("should update name when auto-fill Button is clicked", () => {
        const wrapper = shallow(<CreateSample {...props} />);
        const selected = ["abc123-FooBar.fq.gz"];
        wrapper.setState({ ...state, selected });
        wrapper.find(InputIcon).simulate("click");
        expect(wrapper.state()).toEqual({ ...state, name: "FooBar", selected });
    });

    it("should update selected and errorFile when read is selected", () => {
        const wrapper = shallow(<CreateSample {...props} />);
        wrapper.setState(state);
        wrapper.find("ReadSelector").prop("onSelect")(["foo"]);
        expect(wrapper.state()).toEqual({ ...state, selected: ["foo"] });
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const subtractions = [
            {
                id: "foo_subtraction",
                name: "Foo Subtraction"
            },
            {
                id: "bar_subtraction",
                name: "Bar Subtraction"
            }
        ];

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
            subtraction: {
                shortlist: [
                    {
                        id: "foo_subtraction",
                        name: "Foo Subtraction"
                    },
                    {
                        id: "bar_subtraction",
                        name: "Bar Subtraction"
                    }
                ]
            }
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
            subtractions
        });
    });
});
describe("mapDispatchToProps()", () => {
    const dispatch = jest.fn();
    const props = mapDispatchToProps(dispatch);

    it("should return onLoadSubtractionsAndFiles() in props", () => {
        props.onLoadSubtractionsAndFiles();
        expect(dispatch).toHaveBeenCalledWith({ type: "FIND_READ_FILES_REQUESTED" });
        expect(dispatch).toHaveBeenCalledWith({ type: "LIST_SUBTRACTION_IDS_REQUESTED" });
    });

    it("should return createSample() in props", () => {
        props.onCreate("name", "isolate", "host", "locale", "libraryType", "subtraction", "files");
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

    it("should return onClearError() in props", () => {
        props.onClearError();
        expect(dispatch).toHaveBeenCalledWith({ error: "CREATE_SAMPLE_ERROR", type: "CLEAR_ERROR" });
    });
});

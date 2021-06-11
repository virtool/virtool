import React from "react";
import { Input, InputIcon } from "../../../../base";
import { CreateSample, mapDispatchToProps, mapStateToProps } from "../Create";
import { LibraryTypeSelector } from "../LibraryTypeSelector";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("<CreateSample>", () => {
    let props;
    let state;
    let e;

    // Might need the upload date (created_at)
    const fileName = "file";
    const readyReads = Array(3)
        .fill(0)
        .map((_, id) => ({ id, name: `${fileName} ${id}`, name_on_disk: `${id}-${fileName}.fq.gz`, size: 0 }));

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
            readyReads,
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

    //===============================
    // Helper Functions
    //===============================
    const submitForm = () => userEvent.click(screen.getByRole("button", { name: /Save/i }));

    const inputFormRequirements = (sampleName = "Name") => {
        userEvent.type(screen.getByRole("textbox", { name: /Sample Name/i }), sampleName);
        userEvent.click(screen.getByText(readyReads[0].name));
        userEvent.click(screen.getByText(readyReads[1].name));
        submitForm();
    };

    //===============================
    // Tests
    //===============================
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

    // it("handleChange() should update state [name] and [error] when InputError is changed and [name=name]", async () => {
    // const wrapper = shallow(<CreateSample {...props} />);
    // wrapper.setState(state);
    // wrapper.find(Input).at(0).simulate("change", e);
    // expect(wrapper.state()).toEqual({ ...state, name: "foo" });
    //}

    it("should fail to submit and show errors on an empty submission", async () => {
        renderWithProviders(<CreateSample {...props} />);
        // Ensure errors aren't shown prematurely
        expect(screen.queryByText("Required Field")).not.toBeInTheDocument();
        expect(screen.queryByText("At least one read file must be attached to the sample")).not.toBeInTheDocument();

        submitForm();

        await waitFor(() => {
            expect(props.onCreate).toHaveBeenCalledTimes(0);
            expect(screen.getByText("Required Field")).toBeInTheDocument();
            expect(screen.getByText("At least one read file must be attached to the sample")).toBeInTheDocument();
        });
    });

    it("should submit when required fields are completed", async () => {
        const name = "Sample Name";
        renderWithProviders(<CreateSample {...props} />);
        inputFormRequirements(name);

        const anything = expect.anything();

        await waitFor(() =>
            expect(props.onCreate).toHaveBeenCalledWith(name, anything, anything, anything, anything, anything, [0, 1])
        );
    });

    it("should render userGroup when forcedGroup props is True", () => {
        renderWithProviders(<CreateSample {...props} />);
        expect(screen.queryByText("User Group")).not.toBeInTheDocument();
    });

    it("should render userGroup when forcedGroup props is False", () => {
        props.forceGroupChoice = true;
        renderWithProviders(<CreateSample {...props} />);
        expect(screen.getByText("User Group")).toBeInTheDocument();
    });

    it("should update the sample name when the magic icon is pressed", async () => {
        renderWithProviders(<CreateSample {...props} />);
        const nameInput = screen.getByRole("textbox", { name: /Sample Name/i });
        expect(nameInput.value).toBe("");

        userEvent.click(screen.getByText(readyReads[0].name));
        userEvent.click(screen.getByTestId("Auto Fill"));
        expect(nameInput.value).toBe(fileName);
    });

    // it("handleChange() should update [name] when [name='isolate']", () => {
    //     e.target.name = "isolate";
    //     e.target.value = "Foo Isolate";

    //     const wrapper = shallow(<CreateSample {...props} />);
    //     wrapper.setState(state);
    //     wrapper.find(Input).at(0).simulate("change", e);

    //     expect(wrapper.state()).toEqual({ ...state, isolate: "Foo Isolate" });
    // });

    // it("handleLibrarySelect() should update libraryType when LibraryTypeSelector is selected", () => {
    //     const libraryType = "srna";
    //     const wrapper = shallow(<CreateSample {...props} />);
    //     wrapper.setState(state);
    //     wrapper.find(LibraryTypeSelector).at(0).simulate("select", libraryType);
    //     expect(wrapper.state()).toEqual({ ...state, libraryType });
    // });

    // it("should display error when form submitted with no name", () => {
    //     const wrapper = shallow(<CreateSample {...props} />);
    //     wrapper.setState({ ...state, name: "" });
    //     wrapper.find("form").simulate("submit", e);
    //     expect(wrapper.state()).toEqual({ ...state, name: "", errorName: "Required Field" });
    //     expect(wrapper).toMatchSnapshot();
    // });

    // it("handleSubmit() should update errorFile when form is submitted and [this.props.selected=[]]", () => {
    //     const wrapper = shallow(<CreateSample {...props} />);
    //     wrapper.setState({
    //         ...state,
    //         selected: []
    //     });
    //     wrapper.find("form").simulate("submit", e);
    //     expect(wrapper.state()).toEqual({
    //         ...state,
    //         selected: [],
    //         errorFile: "At least one read file must be attached to the sample"
    //     });
    // });

    // it("should call onCreate() when form is submitted and [hasError=false]", () => {
    //     const wrapper = shallow(<CreateSample {...props} />);
    //     wrapper.setState({ ...state, selected: ["foo"] });
    //     wrapper.find("form").simulate("submit", e);

    //     expect(props.onCreate).toHaveBeenCalledWith("Sample 1", "Isolate", "Host", "Timbuktu", "normal", "sub_bar", [
    //         "foo"
    //     ]);
    // });

    // it("should update name when auto-fill Button is clicked", () => {
    //     const wrapper = shallow(<CreateSample {...props} />);
    //     const selected = ["abc123-FooBar.fq.gz"];
    //     wrapper.setState({ ...state, selected });
    //     wrapper.find(InputIcon).simulate("click");
    //     expect(wrapper.state()).toEqual({ ...state, name: "FooBar", selected });
    // });

    // it("should update selected and errorFile when read is selected", () => {
    //     const wrapper = shallow(<CreateSample {...props} />);
    //     wrapper.setState(state);
    //     wrapper.find("ReadSelector").prop("onSelect")(["foo"]);
    //     expect(wrapper.state()).toEqual({ ...state, selected: ["foo"] });
    // });
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
                data: {
                    sample_group: "force_choice"
                }
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

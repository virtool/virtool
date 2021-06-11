import React from "react";
import { CreateSample, mapDispatchToProps, mapStateToProps } from "../Create";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("<CreateSample>", () => {
    const readFileName = "large";
    let props;
    let values;

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
            readyReads: Array(3)
                .fill(0)
                .map((_, id) => ({
                    id,
                    name: `${readFileName} ${id}`,
                    name_on_disk: `${id}-${readFileName}.fq.gz`,
                    size: 0
                })),
            forceGroupChoice: false,
            onCreate: jest.fn(),
            onLoadSubtractionsAndFiles: jest.fn()
        };
        values = {
            name: "Sample 1",
            selected: ["abc123-Foo.fq.gz", "789xyz-Bar.fq.gz"],
            host: "Host",
            isolate: "Isolate",
            locale: "Timbuktu",
            subtractionId: "sub_bar",
            libraryType: "sRNA"
        };
    });

    //===============================
    // Helper Functions
    //===============================
    const submitForm = () => userEvent.click(screen.getByRole("button", { name: /Save/i }));

    const inputFormRequirements = (sampleName = "Name") => {
        userEvent.type(screen.getByLabelText("Sample Name"), sampleName);
        userEvent.click(screen.getByText(props.readyReads[0].name));
        userEvent.click(screen.getByText(props.readyReads[1].name));
    };

    //===============================
    // Tests
    //===============================
    it("should render", () => {
        const wrapper = shallow(<CreateSample {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render LoadingPlaceholder when [props.subtractions=null]", () => {
        props.subtractions = null;
        const wrapper = shallow(<CreateSample {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render LoadingPlaceholder when [props.readyReads=null]", () => {
        props.readyReads = null;
        const wrapper = shallow(<CreateSample {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should fail to submit and show errors on empty submission", async () => {
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
        const { name } = values;
        renderWithProviders(<CreateSample {...props} />);
        inputFormRequirements(name);
        submitForm();

        await waitFor(() =>
            expect(props.onCreate).toHaveBeenCalledWith(name, "", "", "", "normal", props.subtractions[0].id, [0, 1])
        );
    });

    it("should submit expected results when form is fully completed", async () => {
        renderWithProviders(<CreateSample {...props} />);
        const { name, isolate, host, locale, libraryType } = values;
        inputFormRequirements(name);

        // Fill out the rest of the form and submit
        userEvent.type(screen.getByLabelText("Isolate"), isolate);
        userEvent.type(screen.getByLabelText("Host"), host);
        userEvent.type(screen.getByLabelText("Locale"), locale);
        userEvent.selectOptions(screen.getByLabelText("Default Subtraction"), props.subtractions[1].name);
        userEvent.click(screen.getByText(libraryType));
        submitForm();

        await waitFor(() =>
            expect(props.onCreate).toHaveBeenCalledWith(
                name,
                isolate,
                host,
                locale,
                libraryType.toLowerCase(),
                props.subtractions[1].id,
                [0, 1]
            )
        );
    });

    it("should render userGroup when [props.forcedGroup=true]", () => {
        renderWithProviders(<CreateSample {...props} />);
        expect(screen.queryByText("User Group")).not.toBeInTheDocument();
    });

    it("should render userGroup when [props.forcedGroup=false]", () => {
        props.forceGroupChoice = true;
        renderWithProviders(<CreateSample {...props} />);
        expect(screen.getByText("User Group")).toBeInTheDocument();
    });

    it("should update the sample name when the magic icon is pressed", async () => {
        renderWithProviders(<CreateSample {...props} />);
        const nameInput = screen.getByRole("textbox", { name: /Sample Name/i });
        expect(nameInput.value).toBe("");

        userEvent.click(screen.getByText(props.readyReads[0].name));
        userEvent.click(screen.getByTestId("Auto Fill"));
        expect(nameInput.value).toBe(readFileName);
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

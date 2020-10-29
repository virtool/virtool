import { mapStateToProps, SampleDetailGeneral } from "../General";
describe("<SampleDetailGeneral />", () => {
    let props;

    beforeEach(() => {
        props = {
            count: 235,
            encoding: "Sanger / Illumina 2.1",
            gc: "42.3%",
            host: "Malus domestica",
            isolate: "Isolate Foo",
            lengthRange: "41 - 76",
            locale: "Bar",
            name: "Foo",
            notes: "Edit the sample to add additional notes.",
            paired: false,
            subtraction: {
                id: "baz",
                name: "Arabidopsis thaliana"
            },
            libraryType: ""
        };
    });

    it.each([true, false])("should render with [paired=%p]", paired => {
        props.paired = paired;
        const wrapper = shallow(<SampleDetailGeneral {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <ReleaseMarkdown /> component", () => {
        const wrapper = shallow(<SampleDetailGeneral {...props} />);
        expect(wrapper.find("ReleaseMarkdown")).toMatchSnapshot();
    });

    it("renders <EditSample /> component", () => {
        const wrapper = shallow(<SampleDetailGeneral {...props} />);
        expect(wrapper.find("EditSample")).toMatchSnapshot();
    });

    it("renders both Edit notes components ", () => {
        const wrapper = shallow(<SampleDetailGeneral />);
        expect(wrapper.find("ReleaseMarkdown")).toMatchSnapshot();
        expect(wrapper.find("TextArea")).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    let state;

    beforeEach(() => {
        state = {
            samples: {
                detail: {
                    id: "foo",
                    name: "Foo",
                    host: "Malus domestica",
                    isolate: "Isolate Foo",
                    locale: "Bar",
                    notes: "FooBar",
                    paired: false,
                    quality: {
                        gc: 31.2452,
                        count: 13198329,
                        encoding: "Foo 1.2",
                        length: [50, 100]
                    },
                    library_type: "normal",
                    subtraction: { id: "baz", name: "Arabidopsis thaliana" }
                }
            }
        };
    });

    it("should return props", () => {
        const props = mapStateToProps(state);
        expect(props).toEqual({
            encoding: "Foo 1.2",
            host: "Malus domestica",
            isolate: "Isolate Foo",
            locale: "Bar",
            notes: "FooBar",
            name: "Foo",
            paired: false,
            gc: "31.2 %",
            count: "13.2 m",
            lengthRange: "50 - 100",
            subtraction: { id: "baz", name: "Arabidopsis thaliana" },
            libraryType: "Normal"
        });
    });

    it.each([
        ["normal", "Normal"],
        ["srna", "sRNA"],
        ["amplicon", "Amplicon"]
    ])("state.library_type(%s) should equal props.libraryType(%s)", (a, b) => {
        state.samples.detail.library_type = a;
        const result = mapStateToProps(state).libraryType;
        expect(result).toEqual(b);
    });
});

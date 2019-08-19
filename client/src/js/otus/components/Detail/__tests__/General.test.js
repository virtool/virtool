import { OTUGeneral, mapStateToProps } from "../General";

describe("<OTUGeneral />", () => {
    let props;

    beforeEach(() => {
        props = {
            abbreviation: "FB",
            issues: {
                empty_otu: false,
                empty_isolate: ["456def"],
                empty_sequence: false,
                isolate_inconsistency: false
            },
            isolates: [{ id: "baz" }],
            name: "Foo Bar",
            version: 3
        };
    });

    it("should render with issues", () => {
        const wrapper = shallow(<OTUGeneral {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render without issues", () => {
        props.issues = null;
        const wrapper = shallow(<OTUGeneral {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const issues = {
            empty_otu: false,
            empty_isolate: ["456def"],
            empty_sequence: false,
            isolate_inconsistency: false
        };
        const isolates = [{ id: "baz" }];
        const state = {
            otus: {
                detail: {
                    abbreviation: "FB",
                    issues,
                    isolates,
                    name: "Foo Bar",
                    version: 3
                }
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            abbreviation: "FB",
            issues,
            isolates,
            name: "Foo Bar",
            version: 3
        });
    });
});

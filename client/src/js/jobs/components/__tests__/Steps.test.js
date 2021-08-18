import { JobSteps, mapStateToProps } from "../Steps";

describe("<JobSteps />", () => {
    it("should render", () => {
        const props = {
            status: [{ state: "waiting" }, { state: "running" }],
            workflow: "bowtie_build"
        };
        const wrapper = shallow(<JobSteps {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    it("should map state to props correctly", () => {
        const status = [{ state: "waiting" }, { state: "running" }];

        const workflow = "bowtie_build";

        const props = mapStateToProps({
            jobs: {
                detail: {
                    status,
                    workflow
                }
            }
        });

        expect(props).toEqual({
            status,
            workflow
        });
    });
});

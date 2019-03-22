import { JobSteps, mapStateToProps } from "../Steps";

describe("<JobSteps />", () => {
    it("should render", () => {
        const props = {
            status: [{ state: "waiting" }, { state: "running" }],
            task: "bowtie_build"
        };
        const wrapper = shallow(<JobSteps {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    it("should map state to props correctly", () => {
        const status = [{ state: "waiting" }, { state: "running" }];

        const task = "bowtie_build";

        const props = mapStateToProps({
            jobs: {
                detail: {
                    status,
                    task
                }
            }
        });

        expect(props).toEqual({
            status,
            task
        });
    });
});

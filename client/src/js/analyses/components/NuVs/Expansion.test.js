import NuVsExpansion from "./Expansion";
import { Provider } from "react-redux";

describe("<NuVsExpansion />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        const store = mockStore({ analyses: { detail: { id: "123abc" } } });
        props = {
            index: 0,
            analysisId: "test-analysis",
            blast: {},
            orfs: [
                {
                    frame: 1,
                    hits: [],
                    index: 0,
                    pos: [1, 2],
                    pro: "ABC",
                    strand: -1
                }
            ],
            sequence: "test-sequence",
            maxSequenceLength: 10
        };
        wrapper = mount(
            <Provider store={store}>
                <NuVsExpansion {...props} />
            </Provider>
        );
        expect(wrapper.children().children()).toMatchSnapshot();
    });

});

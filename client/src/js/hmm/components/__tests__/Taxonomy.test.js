import { HMMTaxonomy } from "../Taxonomy";

describe("<HMMTaxonomy />", () => {
    it("should render", () => {
        const counts = {
            Begomovirus: 191,
            Curtovirus: 3,
            None: 1,
            Topocuvirus: 1
        };

        const wrapper = shallow(<HMMTaxonomy counts={counts} />);
        expect(wrapper).toMatchSnapshot();
    });
});

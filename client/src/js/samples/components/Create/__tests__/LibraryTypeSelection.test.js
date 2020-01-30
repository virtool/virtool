import { LibraryTypeSelection } from "../LibraryTypeSelection";

describe("<LibraryTypeSelection>", () => {
    let props;
    beforeEach(() => {
        props = {
            onSelect: jest.fn(),
            libraryType: "normal"
        };
    });

    it("should select Normal type when [LibraryTypeSelection='normal']", () => {
        const wrapper = shallow(<LibraryTypeSelection {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should select sRNA type when [LibraryTypeSelection='srna']", () => {
        props.libraryType = "srna";
        const wrapper = shallow(<LibraryTypeSelection {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should select Amplicon type when [LibraryTypeSelection='amplicon']", () => {
        props.libraryType = "amplicon";
        const wrapper = shallow(<LibraryTypeSelection {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should call onSelect with libraryType normal when Normal type is clicked", () => {
        const wrapper = shallow(<LibraryTypeSelection {...props} />);
        wrapper
            .find("SelectBox")
            .at(0)
            .simulate("click");
        expect(props.onSelect).toHaveBeenCalledWith("normal");
    });
    it("should call onSelect with libraryType srna when srna type is clicked", () => {
        const wrapper = shallow(<LibraryTypeSelection {...props} />);
        wrapper
            .find("SelectBox")
            .at(1)
            .simulate("click");
        expect(props.onSelect).toHaveBeenCalledWith("srna");
    });
    it("should call onSelect with libraryType amplicon when amplicon type is clicked", () => {
        const wrapper = shallow(<LibraryTypeSelection {...props} />);
        wrapper
            .find("SelectBox")
            .at(2)
            .simulate("click");
        expect(props.onSelect).toHaveBeenCalledWith("amplicon");
    });
});

import { LibraryTypeSelector } from "../LibraryTypeSelector";

describe("<LibraryTypeSelector>", () => {
    let props;
    beforeEach(() => {
        props = {
            onSelect: jest.fn(),
            libraryType: "normal"
        };
    });

    it("should select Normal type when [LibraryTypeSelector='normal']", () => {
        const wrapper = shallow(<LibraryTypeSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should select sRNA type when [LibraryTypeSelector='srna']", () => {
        props.libraryType = "srna";
        const wrapper = shallow(<LibraryTypeSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should select Amplicon type when [LibraryTypeSelector='amplicon']", () => {
        props.libraryType = "amplicon";
        const wrapper = shallow(<LibraryTypeSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should call onSelect with libraryType normal when Normal type is clicked", () => {
        const wrapper = shallow(<LibraryTypeSelector {...props} />);
        wrapper.find("SelectBox").at(0).simulate("click");
        expect(props.onSelect).toHaveBeenCalledWith("normal");
    });
    it("should call onSelect with libraryType srna when srna type is clicked", () => {
        const wrapper = shallow(<LibraryTypeSelector {...props} />);
        wrapper.find("SelectBox").at(1).simulate("click");
        expect(props.onSelect).toHaveBeenCalledWith("srna");
    });
    it("should call onSelect with libraryType amplicon when amplicon type is clicked", () => {
        const wrapper = shallow(<LibraryTypeSelector {...props} />);
        wrapper.find("SelectBox").at(2).simulate("click");
        expect(props.onSelect).toHaveBeenCalledWith("amplicon");
    });
});

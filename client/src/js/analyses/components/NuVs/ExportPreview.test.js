import NuVsExportPreview from "./ExportPreview";

describe("<NuVsExportPreview />", () => {
  let wrapper;

  it("renders correctly when [mode=contigs]", () => {
    wrapper = shallow(<NuVsExportPreview mode="contigs" />);

    expect(wrapper).toMatchSnapshot();
  });

  it("renders correctly otherwise", () => {
    wrapper = shallow(<NuVsExportPreview mode="test" />);

    expect(wrapper).toMatchSnapshot();
  });
});

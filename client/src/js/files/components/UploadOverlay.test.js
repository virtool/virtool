import * as actions from "../actions";
import UploadOverlay, { UploadItem } from "./UploadOverlay";

describe("<UploadOverlay />", () => {
  let initialState;
  let store;
  let wrapper;

  it("renders correctly", () => {
    initialState = {
      files: {
        uploads: [
          {
            fileType: "reference",
            localId: "123abc",
            name: "test_reads.fastq.gz",
            progress: 100,
            size: 1024
          },
          {
            fileType: "reads",
            localId: "456def",
            name: "test_reads.fastq.gz",
            progress: 0,
            size: 1024
          },
          {
            fileType: "reads",
            localId: "789ghi",
            name: "test_reads.fastq.gz",
            progress: 50,
            size: 1024
          }
        ],
        showUploadOverlay: true,
        uploadsComplete: false
      }
    };
    store = mockStore(initialState);
    wrapper = shallow(<UploadOverlay store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("renders empty <div /> if no uploads or all uploads are complete", () => {
    initialState = {
      uploads: [],
      showUploadOverlay: false,
      uploadsComplete: true
    };
    store = mockStore(initialState);
    wrapper = shallow(<UploadOverlay store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("renders <UploadItem /> subcomponent correctly", () => {
    const props = {
      localId: "123abc",
      name: "test-file",
      progress: 25,
      size: 1024
    };
    wrapper = shallow(<UploadItem {...props} />);
    expect(wrapper).toMatchSnapshot();

    expect(wrapper.find({ bsStyle: "success" }).length).toEqual(1);

    wrapper.setProps({ progress: 100 });
    expect(wrapper.find({ bsStyle: "primary" }).length).toEqual(1);
  });

  it("Clicking on close icon dispatches hideUploadOverlay() action", () => {
    const spy = sinon.spy(actions, "hideUploadOverlay");
    expect(spy.called).toBe(false);

    initialState = {
      files: {
        uploads: [
          {
            fileType: "reads",
            localId: "123abc",
            name: "test_reads.fastq.gz",
            progress: 50,
            size: 1024
          }
        ],
        showUploadOverlay: true,
        uploadsComplete: false
      }
    };
    store = mockStore(initialState);
    wrapper = mount(<UploadOverlay store={store} />);
    wrapper.find("button").prop("onClick")();
    expect(spy.calledOnce).toBe(true);

    spy.restore();
  });
});

import * as actions from "../actions";
import * as indexesActions from "../../indexes/actions";
import * as hmmActions from "../../hmm/actions";
import AnalysesListContainer, { AnalysesToolbar } from "./List";

describe("<AnalysesList />", () => {
  const initialState = {
    account: {
      administrator: false,
      id: "test-user",
      groups: []
    },
    analyses: {
      sampleId: "test-sample",
      documents: [],
      filter: "search",
      readyIndexes: []
    },
    samples: {
      detail: { all_write: false, group_write: false, group: "" }
    },
    hmms: { status: { installed: false } }
  };
  const store = mockStore(initialState);
  let props;
  let wrapper;

  it("renders correctly", () => {
    wrapper = shallow(<AnalysesListContainer store={store} />).dive();
    expect(wrapper).toMatchSnapshot();

    wrapper.setProps({
      analyses: [{ timestamp: "2018-01-01T00:00:00.000000Z" }],
      hmms: { status: { installed: true } }
    });
    expect(wrapper).toMatchSnapshot();
  });

  it("renders <LoadingPlaceholder /> when analyses, hmms, or indexeses data are null", () => {
    wrapper = shallow(<AnalysesListContainer store={store} />).dive();
    wrapper.setProps({ indexes: null });
    expect(wrapper).toMatchSnapshot();
  });

  it("Clicking on create button or closing modal changes modal's show state", () => {
    wrapper = shallow(<AnalysesListContainer store={store} />).dive();
    expect(wrapper.state("show")).toBe(false);

    wrapper.find({ term: "search" }).prop("onClick")();
    expect(wrapper.state("show")).toBe(true);

    wrapper.find({ userId: "test-user" }).prop("onHide")();
    expect(wrapper.state("show")).toBe(false);
  });

  it("renders <AnalysesToolbar /> subcomponent", () => {
    props = {
      term: "test",
      isDisabled: false,
      onClick: jest.fn(),
      onFilter: jest.fn()
    };
    wrapper = shallow(<AnalysesToolbar {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe("Dispatch Functions", () => {
    let spy;

    it("Entering search input dispatches filterAnalyses() action", () => {
      spy = sinon.spy(actions, "filterAnalyses");
      expect(spy.called).toBe(false);

      wrapper = shallow(<AnalysesListContainer store={store} />).dive();
      wrapper.find({ term: "search" }).prop("onFilter")({
        target: { value: "example" }
      });

      expect(spy.calledWith("test-sample", "example")).toBe(true);

      spy.restore();
    });

    it("Creating a new analysis dispatches analyze() action", () => {
      spy = sinon.spy(actions, "analyze");
      expect(spy.called).toBe(false);

      const sampleId = "test-sample1";
      const references = [{ refId: "test-ref" }];
      const algorithm = "test-algorithm";
      const userId = "test-user";

      wrapper = shallow(<AnalysesListContainer store={store} />).dive();
      wrapper.find({ userId: "test-user" }).prop("onSubmit")(
        sampleId,
        references,
        algorithm,
        userId
      );

      expect(
        spy.calledWith(sampleId, references[0].refId, algorithm, userId)
      ).toBe(true);

      spy.restore();
    });

    it("Component mount dispatches listHmms() and listReadyIndexes() actions", () => {
      const spyListIndexes = sinon.spy(indexesActions, "listReadyIndexes");
      const spyListHMMs = sinon.spy(hmmActions, "listHmms");
      expect(spyListIndexes.called).toBe(false);
      expect(spyListHMMs.called).toBe(false);

      wrapper = shallow(<AnalysesListContainer store={store} />).dive();
      expect(spyListIndexes.calledOnce).toBe(true);
      expect(spyListHMMs.calledOnce).toBe(true);

      spyListIndexes.restore();
      spyListHMMs.restore();
    });
  });
});

import { SubtractionDetail } from "./Detail";

describe("<SubtractionDetail />", () => {
  let props;
  let wrapper;

  it("renders correctly", () => {
    props = {
      match: { params: { subtractionId: "test" } },
      detail: {
        id: "123abc",
        ready: true,
        linked_samples: [{ id: "456def", name: "test-sample" }],
        file: { id: "test-file" },
        gc: { a: 0.2, t: 0.2, g: 0.2, c: 0.2, n: 0.2 },
        nickname: "test-nickname"
      },
      canModify: true,
      error: "",
      onGet: jest.fn(),
      onShowRemove: jest.fn()
    };
    wrapper = shallow(<SubtractionDetail {...props} />);
    expect(wrapper).toMatchSnapshot();
  });
});

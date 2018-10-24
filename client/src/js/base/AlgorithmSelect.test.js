import React from "react";
import { AlgorithmSelect, algorithms } from "./AlgorithmSelect";

const setup = props =>
  shallow(
    <AlgorithmSelect
      noLabel={props.noLabel}
      value={props.value}
      onChange={props.onChange}
      hasHmm={props.hasHmm}
    />
  );

describe("<AlgorithmSelect />", () => {
  let wrapper;
  let props;
  let inputProps;

  it("should render an Input component with valid props", () => {
    props = {
      noLabel: false,
      value: "pathoscope_bowtie",
      onChange: jest.fn(),
      hasHmm: false
    };
    wrapper = setup(props);

    inputProps = wrapper.find("Input").props();

    expect(wrapper).toMatchSnapshot();

    expect(inputProps.name).toEqual("algorithm");
    expect(inputProps.type).toEqual("select");
    expect(inputProps.label).toEqual("Algorithm");
    expect(inputProps.value).toEqual(props.value);

    props = {
      noLabel: true,
      value: "nuvs",
      onChange: jest.fn(),
      hasHmm: true
    };
    wrapper = setup(props);

    inputProps = wrapper.find("Input").props();

    expect(inputProps.label).toEqual(null);
    expect(inputProps.value).toEqual(props.value);
  });

  it("renders option sub-elements for each algorithm type", () => {
    wrapper = mount(
      <AlgorithmSelect
        noLabel={true}
        value="nuvs"
        onChange={jest.fn()}
        hasHmm={false}
      />
    );

    expect(wrapper.find("option").length).toEqual(algorithms.length);

    wrapper.find("option").forEach((node, index) => {
      expect(node.props().value).toEqual(algorithms[index]);
    });
  });

  it("does not crash when no props are supplied", () => {
    props = {
      noLabel: undefined,
      value: undefined,
      onChange: undefined,
      hasHmm: undefined
    };
    wrapper = setup(props);

    expect(wrapper).toMatchSnapshot();
  });
});

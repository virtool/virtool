import React from "react";
import { map } from "lodash-es";
import JobStep from "./Step";

export default class JobSteps extends React.Component {
  render() {
    const stepComponents = map(this.props.steps, (step, index) => (
      <JobStep
        key={index}
        step={step}
        isDone={index < this.props.steps.length - 1}
      />
    ));

    return <div className="steps-container">{stepComponents}</div>;
  }
}

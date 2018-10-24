import React from "react";
import { connect } from "react-redux";
import { Switch, Route } from "react-router-dom";

import { findAnalyses } from "../actions";
import { LoadingPlaceholder } from "../../base";
import AnalysesList from "./List";
import AnalysisDetail from "./Detail";

class Analyses extends React.Component {
  componentDidMount() {
    this.props.findAnalyses(this.props.match.params.sampleId);
  }

  render() {
    if (this.props.analyses === null) {
      return <LoadingPlaceholder margin="130px" />;
    }

    return (
      <Switch>
        <Route
          path="/samples/:sampleId/analyses"
          component={AnalysesList}
          exact
        />
        <Route
          path="/samples/:sampleId/analyses/:analysisId"
          component={AnalysisDetail}
        />
      </Switch>
    );
  }
}

const mapDispatchToProps = dispatch => ({
  findAnalyses: sampleId => {
    dispatch(findAnalyses(sampleId));
  }
});

export default connect(
  null,
  mapDispatchToProps
)(Analyses);

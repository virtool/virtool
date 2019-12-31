import React from "react";
import { connect } from "react-redux";
import { Switch, Route } from "react-router-dom";
import { findHmms } from "../../hmm/actions";
import { listReadyIndexes } from "../../indexes/actions";

import { findAnalyses } from "../actions";
import { LoadingPlaceholder } from "../../base";
import AnalysesList from "./List";
import AnalysisDetail from "./Detail";

export class Analyses extends React.Component {
    componentDidMount() {
        this.props.onFindAnalyses(this.props.sampleId);
        this.props.onFindHmms();
        this.props.onListReadyIndexes();
    }

    render() {
        if (this.props.loading) {
            return <LoadingPlaceholder margin="150px" />;
        }

        return (
            <Switch>
                <Route path="/samples/:sampleId/analyses" component={AnalysesList} exact />
                <Route path="/samples/:sampleId/analyses/:analysisId" component={AnalysisDetail} />
            </Switch>
        );
    }
}

const mapStateToProps = state => ({
    sampleId: state.samples.detail.id,
    loading: state.analyses.documents === null || state.hmms.documents === null || state.analyses.readyIndexes === null
});

const mapDispatchToProps = dispatch => ({
    onFindAnalyses: sampleId => {
        dispatch(findAnalyses(sampleId, "", 1));
    },
    onFindHmms: () => {
        dispatch(findHmms());
    },
    onListReadyIndexes: () => {
        dispatch(listReadyIndexes());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Analyses);

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { Switch, Route } from "react-router-dom";

import { findAnalyses } from "../../actions";
import AnalysesList from "./List";
import AnalysisDetail from "./Detail";

class Analyses extends React.Component {

    static propTypes = {
        match: PropTypes.object,
        analyses: PropTypes.arrayOf(PropTypes.object),
        findAnalyses: PropTypes.func
    };

    componentDidMount () {
        this.props.findAnalyses(this.props.match.params.sampleId);
    }

    render () {

        if (this.props.analyses === null) {
            return <div />;
        }

        return (
            <Switch>
                <Route path="/samples/:sampleId/analyses" component={AnalysesList} exact/>
                <Route path="/samples/:sampleId/analyses/:analysisId" component={AnalysisDetail}/>
            </Switch>
        );
    }
}

AnalysesList.propTypes = {
    account: React.PropTypes.object,
    detail: React.PropTypes.object,
    analyses: React.PropTypes.arrayOf(React.PropTypes.object)
};

const mapStateToProps = (state) => {
    return {
        detail: state.samples.detail,
        analyses: state.samples.analyses
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        findAnalyses: (sampleId) => {
            dispatch(findAnalyses(sampleId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(Analyses);

export default Container;


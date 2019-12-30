import React from "react";
import { get, map, sortBy } from "lodash-es";
import { connect } from "react-redux";
import { ListGroup } from "react-bootstrap";
import { routerLocationHasState } from "../../utils/utils";

import { findAnalyses } from "../actions";
import { getCanModify } from "../../samples/selectors";
import { NoneFound } from "../../base/index";
import CreateAnalysis from "./Create/Create";
import AnalysisItem from "./Item";
import AnalysesToolbar from "./Toolbar";
import AnalysisHMMAlert from "./HMMAlert";

export class AnalysesList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            show: false
        };
    }

    handleFind = e => {
        this.props.onFind(this.props.sampleId, e.target.value);
    };

    render() {
        // The content that will be shown below the "New Analysis" form.
        let listContent;

        if (this.props.analyses.length) {
            // The components that detail individual analyses.
            listContent = map(sortBy(this.props.analyses, "created_at").reverse(), (document, index) => (
                <AnalysisItem key={index} {...document} />
            ));
        } else {
            listContent = <NoneFound noun="analyses" noListGroup />;
        }

        return (
            <div>
                <AnalysisHMMAlert />
                <AnalysesToolbar />
                <ListGroup>{listContent}</ListGroup>

                <CreateAnalysis
                    id={this.props.sampleId}
                    show={this.state.show}
                    onHide={() => this.setState({ show: false })}
                    onSubmit={this.props.onAnalyze}
                    hasHmm={!!this.props.hmmsInstalled}
                    refIndexes={this.props.indexes}
                    userId={this.props.userId}
                />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    showCreate: routerLocationHasState(state, "createAnalysis"),
    userId: state.account.id,
    sampleId: state.analyses.sampleId,
    analyses: state.analyses.documents,
    term: state.analyses.term,
    indexes: state.analyses.readyIndexes,
    hmmsInstalled: !!get(state, "hmms.status.installed"),
    canModify: getCanModify(state)
});

const mapDispatchToProps = dispatch => ({
    onFind: (sampleId, term, page) => {
        dispatch(findAnalyses(sampleId, term, page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AnalysesList);

import { get, map, sortBy } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { NoneFoundBox } from "../../base/index";
import { getCanModify } from "../../samples/selectors";
import { routerLocationHasState } from "../../utils/utils";

import { findAnalyses } from "../actions";
import CreateAnalysis from "./Create/Create";
import AnalysisHMMAlert from "./HMMAlert";
import AnalysisItem from "./Item";
import AnalysesToolbar from "./Toolbar";

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
            listContent = <NoneFoundBox noun="analyses" />;
        }

        return (
            <div>
                <AnalysisHMMAlert />
                <AnalysesToolbar />

                {listContent}

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

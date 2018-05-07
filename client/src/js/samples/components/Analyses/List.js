import React from "react";
import { map, sortBy } from "lodash-es";
import { connect } from "react-redux";
import { Alert, FormControl, FormGroup, InputGroup, ListGroup } from "react-bootstrap";
import { Link } from "react-router-dom";

import AnalysisItem from "./Item";
import CreateAnalysis from "./Create";
import { analyze } from "../../actions";
import { getCanModify } from "../../selectors";
import { findIndexes } from "../../../indexes/actions";
import { fetchHmms } from "../../../hmm/actions";
import { Icon, Button, LoadingPlaceholder, NoneFound, Flex, FlexItem } from "../../../base";

const AnalysesToolbar = ({ onClick, isDisabled }) => (
    <div className="toolbar">
        <FormGroup>
            <InputGroup>
                <InputGroup.Addon>
                    <Icon name="search" />
                </InputGroup.Addon>
                <FormControl type="text" />
            </InputGroup>
        </FormGroup>
        <Button
            icon="plus-square"
            tip="New Analysis"
            bsStyle="primary"
            onClick={onClick}
            disabled={isDisabled}
        />
    </div>
);

class AnalysesList extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            show: false
        };
    }

    componentWillMount () {
        this.props.onFindIndexes();
        this.props.onFetchHMMs();
    }

    render () {

        if (this.props.analyses === null || this.props.hmms.documents === null || this.props.indexArray === null) {
            return <LoadingPlaceholder margin="37px" />;
        }

        // The content that will be shown below the "New Analysis" form.
        let listContent;

        if (this.props.analyses.length) {
            // The components that detail individual analyses.
            listContent = map(sortBy(this.props.analyses, "timestamp").reverse(), (document, index) =>
                <AnalysisItem key={index} {...document} />
            );
        } else {
            listContent = <NoneFound noun="analyses" noListGroup />;
        }

        let alertMessage;
        let isBlocked = false;

        if (this.props.modifiedCount) {
            alertMessage = (
                <div>
                    <span>Note: The OTU database has changed. </span>
                    <Link to="/OTUs/indexes">Rebuild the index</Link>
                    <span> to use the latest changes.</span>
                </div>
            );
        }

        if (this.props.indexArray) {
            const readyIndexes = map(this.props.indexArray, ["ready", true]);

            if (!readyIndexes.length) {
                alertMessage = (
                    <div>
                        <span>
                            A OTU database index build is in progress.
                        </span>
                    </div>
                );

                isBlocked = true;
            }
        } else {
            alertMessage = (
                <div>
                    <span>A OTU database is not found. </span>
                    <Link to="/OTUs/indexes">Add a database</Link>
                    <span> to use in analyses.</span>
                </div>
            );

            isBlocked = true;
        }


        let indexAlert;

        if (alertMessage) {
            indexAlert = (
                <Alert bsStyle="warning" icon="info">
                    {alertMessage}
                </Alert>
            );
        }

        let hmmAlert;

        if (!this.props.hmms.file_exists || !this.props.hmms.total_count) {
            hmmAlert = (
                <Alert bsStyle="warning">
                    <Flex alignItems="center">
                        <Icon name="info" />
                        <FlexItem pad={5}>
                            <span>The HMM data is not installed. </span>
                            <Link to="/hmm">Install HMMs</Link>
                            <span> to use in further NuV analyses.</span>
                        </FlexItem>
                    </Flex>
                </Alert>
            );
        }

        return (
            <div>
                {hmmAlert}
                {indexAlert}

                {this.props.canModify ?
                    <AnalysesToolbar
                        onClick={() => this.setState({show: true})}
                        isDisabled={isBlocked}
                    /> : null}

                <ListGroup>
                    {listContent}
                </ListGroup>

                <CreateAnalysis
                    id={this.props.detail.id}
                    show={this.state.show}
                    onHide={() => this.setState({show: false})}
                    onSubmit={this.props.onAnalyze}
                    hasHmm={this.props.hmms.total_count && this.props.hmms.file_exists}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    detail: state.samples.detail,
    analyses: state.samples.analyses,
    modifiedCount: state.indexes.modified_OTU_count,
    indexArray: state.indexes.documents,
    hmms: state.hmms,
    canModify: getCanModify(state)
});

const mapDispatchToProps = (dispatch) => ({

    onAnalyze: (sampleId, algorithm) => {
        dispatch(analyze(sampleId, algorithm));
    },

    onFetchHMMs: () => {
        dispatch(fetchHmms());
    },

    onFindIndexes: () => {
        dispatch(findIndexes());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(AnalysesList);

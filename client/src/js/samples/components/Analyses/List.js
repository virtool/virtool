import React from "react";
import { map, sortBy } from "lodash-es";
import { connect } from "react-redux";
import { ListGroup, FormGroup, InputGroup, FormControl, Alert } from "react-bootstrap";
import { Link } from "react-router-dom";
import { analyze } from "../../actions";
import { Icon, Button, LoadingPlaceholder, NoneFound, Flex, FlexItem } from "../../../base";
import AnalysisItem from "./Item";
import CreateAnalysis from "./Create";
import {getCanModify} from "../../selectors";
import { findIndexes } from "../../../indexes/actions";
import { fetchHmms } from "../../../hmm/actions";

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
            icon="new-entry"
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
                    <span>Note: The virus database has changed. </span>
                    <Link to="/viruses/indexes">Rebuild the index</Link>
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
                            A virus database index build is in progress.
                        </span>
                    </div>
                );

                isBlocked = true;
            }
        } else {
            alertMessage = (
                <div>
                    <span>A virus database is not found. </span>
                    <Link to="/viruses/indexes">Add a database</Link>
                    <span> to use in analyses.</span>
                </div>
            );

            isBlocked = true;
        }

        const indexAlert = alertMessage ? (
            <Alert bsStyle="warning">
                <Flex alignItems="center">
                    <Icon name="info" />
                    <FlexItem pad={5}>
                        {alertMessage}
                    </FlexItem>
                </Flex>
            </Alert>
        ) : null;

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
    modifiedCount: state.indexes.modified_virus_count,
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

const Container = connect(mapStateToProps, mapDispatchToProps)(AnalysesList);

export default Container;

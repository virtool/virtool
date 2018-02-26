import React from "react";
import { map, sortBy } from "lodash-es";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { ListGroup, FormGroup, InputGroup, FormControl, Alert } from "react-bootstrap";

import { analyze } from "../../actions";
import { Icon, Button, LoadingPlaceholder, NoneFound, Flex, FlexItem } from "../../../base";
import AnalysisItem from "./Item";
import CreateAnalysis from "./Create";
import {getCanModify} from "../../selectors";
import { findIndexes } from "../../../indexes/actions";

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
    }

    render () {

        if (this.props.analyses === null) {
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
            const readyIndexes = map(this.props.indexArray, [ "ready", true ]);

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

        const alert = alertMessage ? (
            <Alert bsStyle="warning">
                <Flex alignItems="center">
                    <Icon name="info" />
                    <FlexItem pad={5}>
                        {alertMessage}
                    </FlexItem>
                </Flex>
            </Alert>
        ) : null;

        return (
            <div>
                {alert}

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
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    detail: state.samples.detail,
    analyses: state.samples.analyses,
    canModify: getCanModify(state),
    modifiedCount: state.indexes.modified_virus_count,
    indexArray: state.indexes.documents
});

const mapDispatchToProps = (dispatch) => ({

    onAnalyze: (sampleId, algorithm) => {
        dispatch(analyze(sampleId, algorithm));
    },

    onFindIndexes: () => {
        dispatch(findIndexes());
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(AnalysesList);

export default Container;

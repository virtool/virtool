/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AnalysisList
 */

import React from "react";
import { LinkContainer } from "react-router-bootstrap";
import { includes, sortBy } from "lodash";
import { connect } from "react-redux";
import { ListGroup, FormGroup, InputGroup, FormControl } from "react-bootstrap";

import { analyze, removeAnalysis } from "../../actions";
import { Icon, Button, ListGroupItem } from "../../../base";
import AnalysisItem from "./Item";
import CreateAnalysis from "./Create";

class AnalysesList extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            show: false
        };
    }

    render () {

        if (this.props.analyses === null) {
            return <div />;
        }

        const canModify = (
            this.props.detail.user.id === this.props.account.id ||
            this.props.detail.all_write ||
            this.props.detail.group_write && includes(this.props.account.groups, this.props.detail.group)
        );

        // The content that will be shown below the "New Analysis" form.
        let listContent;

        // Show a list of analyses if there are any.
        if (this.props.analyses.length) {
            // Sort by timestamp so the newest analyses are at the top.
            const sorted = sortBy(this.props.analyses, "timestamp").reverse();

            // The components that detail individual analyses.
            listContent = sorted.map(document =>
                <LinkContainer key={document.id} to={`/samples/${this.props.detail.id}/analyses/${document.id}`}>
                    <AnalysisItem
                        canModify={canModify}
                        onRemove={() => this.props.onRemove(document.id)}
                        {...document}
                    />
                </LinkContainer>
            );
        }

        // If no analyses are associated with the sample, show a panel saying so.
        else {
            listContent = (
                <ListGroupItem className="text-center">
                    <Icon name="info"/> No analyses found
                </ListGroupItem>
            );
        }

        return (
            <div>
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
                        onClick={() => this.setState({show: true})}
                    />
                </div>

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

const mapStateToProps = (state) => {
    return {
        account: state.account,
        detail: state.samples.detail,
        analyses: state.samples.analyses
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onAnalyze: (sampleId, algorithm) => {
            dispatch(analyze(sampleId, algorithm));
        },

        onRemove: (analysisId) => {
            dispatch(removeAnalysis(analysisId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(AnalysesList);

export default Container;

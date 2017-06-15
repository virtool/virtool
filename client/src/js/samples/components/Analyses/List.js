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
import { sortBy } from "lodash";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Row, Col, Label, ListGroup, FormGroup, InputGroup, FormControl } from "react-bootstrap";

import { getTaskDisplayName } from "../../../utils";
import { analyze } from "../../actions";
import { Icon, Button, ListGroupItem, RelativeTime } from "virtool/js/components/Base";
import CreateAnalysis from "./Create";

class AnalysesList extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            show: false
        };
    }

    render () {

        let count = 0;

        if (this.props.analyses === null) {
            return <div />;
        }

        const canModify = this.props.account.permissions.modify_sample;

        // The content that will be shown below the "New Analysis" form.
        let listContent;

        // Show a list of analyses if there are any.
        if (this.props.analyses) {

            // Sort by timestamp so the newest analyses are at the top.
            const sorted = sortBy(this.props.analyses, "timestamp").reverse();

            count = sorted.length;

            // The components that detail individual analyses.
            listContent = sorted.map(document => {

                let end;

                if (document.ready) {
                    end = <Icon name="remove" bsStyle="danger" pullRight />;
                } else {
                    end = (
                        <strong className="pull-right">
                            Running
                        </strong>
                    )
                }

                return (
                    <div className="list-group-item spaced" key={document.analysis_id}>
                        <Row>
                            <Col md={3}>
                                {getTaskDisplayName(document.algorithm)}
                            </Col>
                            <Col md={4}>
                                Started <RelativeTime time={document.timestamp}/> by {document.user_id}
                            </Col>
                            <Col md={1}>
                                <Label>{document.index_version}</Label>
                            </Col>
                            <Col md={4}>
                                {end}
                            </Col>
                        </Row>
                    </div>
                );
            });
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
                    sampleId={this.props.detail.sample_id}
                    show={this.state.show}
                    onHide={() => this.setState({show: false})}
                    onSubmit={this.props.onAnalyze}
                />
            </div>
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
        account: state.account,
        detail: state.samples.detail,
        analyses: state.samples.analyses
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onAnalyze: (sampleId, algorithm) => {
            dispatch(analyze(sampleId, algorithm));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(AnalysesList);

export default Container;

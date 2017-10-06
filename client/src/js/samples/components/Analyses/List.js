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
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { ListGroup, FormGroup, InputGroup, FormControl } from "react-bootstrap";

import { analyze } from "../../actions";
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

    static propTypes = {
        history: PropTypes.object,
        account: PropTypes.object,
        detail: PropTypes.object,
        analyses: PropTypes.arrayOf(PropTypes.object),
        onAnalyze: PropTypes.func
    };

    render () {

        if (this.props.analyses === null) {
            return <div />;
        }

        const canModify = this.props.account.permissions.modify_sample;

        // The content that will be shown below the "New Analysis" form.
        let listContent;

        // Show a list of analyses if there are any.
        if (this.props.analyses.length) {
            // Sort by timestamp so the newest analyses are at the top.
            const sorted = sortBy(this.props.analyses, "timestamp").reverse();

            // The components that detail individual analyses.
            listContent = sorted.map(document => {
                const url = `/samples/${this.props.detail.id}/analyses/${document.id}`;

                return (
                    <AnalysisItem
                        key={document.id}
                        onClick={() => this.props.history.push(url)}
                        canModify={canModify}
                        {...document}
                    />
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
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(AnalysesList);

export default Container;

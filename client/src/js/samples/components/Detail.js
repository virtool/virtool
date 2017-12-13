/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import { push } from "react-router-redux";
import { includes } from "lodash";
import { Switch, Route, Redirect } from "react-router-dom";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Nav, NavItem } from "react-bootstrap";

import { getSample, showRemoveSample } from "../actions";
import { Flex, FlexItem, Icon } from "../../base";
import General from "./General";
import Quality from "./Quality/Quality";
import Analyses from "./Analyses/Analyses";
import RemoveSample from "./Remove";
import Rights from "./Rights";

class SampleDetail extends React.Component {

    componentDidMount () {
        this.props.getSample(this.props.match.params.sampleId);
    }

    render () {

        if (this.props.detail === null) {
            return <div />;
        }

        const detail = this.props.detail;
        const sampleId = this.props.match.params.sampleId;

        let editIcon;

        if (includes(this.props.history.location.pathname, "general")) {
            editIcon = (
                <small style={{paddingLeft: "5px"}}>
                    <Icon
                        bsStyle="warning"
                        name="pencil"
                        tip="Edit Sample"
                        onClick={this.props.showEdit}
                    />
                </small>
            );
        }

        return (
            <div>
                <h3 style={{marginBottom: "20px"}}>
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            <strong>
                                {detail.name}
                            </strong>
                        </FlexItem>

                        {editIcon}

                        <small style={{paddingLeft: "5px"}}>
                            <Icon
                                bsStyle="danger"
                                name="remove"
                                tip="Remove Sample"
                                onClick={() => this.props.showRemove(sampleId, detail.name)}
                            />
                        </small>
                    </Flex>
                </h3>

                <Nav bsStyle="tabs">
                    <LinkContainer to={`/samples/${sampleId}/general`}>
                        <NavItem>General</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/samples/${sampleId}/quality`}>
                        <NavItem>Quality</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/samples/${sampleId}/analyses`}>
                        <NavItem>Analyses</NavItem>
                    </LinkContainer>
                    {this.props.detail.canModify ? (
                        <LinkContainer to={`/samples/${sampleId}/rights`}>
                            <NavItem>
                                <Icon name="key" />
                            </NavItem>
                        </LinkContainer>
                    ): null}
                </Nav>

                <Switch>
                    <Redirect from="/samples/:sampleId" to={`/samples/${sampleId}/general`} exact/>
                    <Route path="/samples/:sampleId/general" component={General}/>
                    <Route path="/samples/:sampleId/quality" component={Quality}/>
                    <Route path="/samples/:sampleId/analyses" component={Analyses}/>
                    <Route path="/samples/:sampleId/rights" component={Rights}/>
                </Switch>

                <RemoveSample id={detail.id} name={detail.name} />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        detail: state.samples.detail
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        getSample: (sampleId) => {
            dispatch(getSample(sampleId));
        },

        showEdit: () => {
            dispatch(push({state: {editSample: true}}));
        },

        showRemove: (sampleId, sampleName) => {
            dispatch(showRemoveSample(sampleId, sampleName));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SampleDetail);

export default Container;


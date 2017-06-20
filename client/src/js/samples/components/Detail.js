/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import { Switch, Route, Redirect } from "react-router-dom";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Nav, NavItem } from "react-bootstrap";

import { getSample } from "../actions";
import { Flex, FlexItem, Icon } from "virtool/js/components/Base";
import General from "./General";
import Quality from "./Quality/Quality";
import Analyses from "./Analyses/Analyses";

class SampleDetail extends React.Component {

    static propTypes = {
        detail: React.PropTypes.object,
        match: React.PropTypes.object,
        history: React.PropTypes.object,
        getSample: React.PropTypes.func
    };

    componentDidMount () {
        this.props.getSample(this.props.match.params.sampleId);
    }

    render () {

        if (this.props.detail === null) {
            return <div />;
        }

        const detail = this.props.detail;
        const sampleId = detail.sample_id;

        return (
            <div>
                <h3 style={{marginBottom: "20px"}}>
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            <strong>
                                {detail.name}
                            </strong>
                        </FlexItem>

                        <Icon
                            bsStyle="danger"
                            name="remove"
                            tip="Remove Sample"
                            style={{fontSize: "18px"}}
                            onClick={() => window.console.log(detail.name)}
                        />
                    </Flex>
                </h3>

                <Flex>
                    <FlexItem>
                        <Nav bsStyle="pills" stacked>
                            <LinkContainer to={`/samples/${sampleId}/general`}>
                                <NavItem>General</NavItem>
                            </LinkContainer>
                            <LinkContainer to={`/samples/${sampleId}/quality`}>
                                <NavItem>Quality</NavItem>
                            </LinkContainer>
                            <LinkContainer to={`/samples/${sampleId}/analyses`}>
                                <NavItem>Analyses</NavItem>
                            </LinkContainer>
                        </Nav>
                    </FlexItem>

                    <FlexItem grow={1} pad={16}>
                        <Switch>
                            <Redirect from="/samples/:sampleId" to={`/samples/${sampleId}/general`} exact/>
                            <Route path="/samples/:sampleId/general" component={General}/>
                            <Route path="/samples/:sampleId/quality" component={Quality}/>
                            <Route path="/samples/:sampleId/analyses" component={Analyses}/>
                        </Switch>
                    </FlexItem>
                </Flex>
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
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SampleDetail);

export default Container;


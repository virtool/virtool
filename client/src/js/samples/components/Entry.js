import React from "react";
import CX from "classnames";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { Row, Col } from "react-bootstrap";
import { ClipLoader } from "halogenium";

import { analyze } from "../actions";
import { Icon, Flex, FlexItem, RelativeTime } from "../../base";

const SampleEntryLabel = ({ icon, label, ready }) => (
    <Flex>
        <FlexItem className={CX("sample-label", {"bg-primary": ready})}>
            <Flex alignItems="center">
                {ready === "ip" ? <ClipLoader size="10px" color="white" /> : <Icon name={icon} />}
                <span style={{paddingLeft: "3px"}} className="hidden-xs hidden-sm">
                    {label}
                </span>
            </Flex>
        </FlexItem>
    </Flex>
);

const SampleEntryLabels = ({ imported, nuvs, pathoscope }) => (
    <Flex>
        <SampleEntryLabel icon="filing" label="Import" ready={imported || true} />&nbsp;
        <SampleEntryLabel icon="bars" label="Pathoscope" ready={pathoscope} />&nbsp;
        <SampleEntryLabel icon="bars" label="NuVs" ready={nuvs} />
    </Flex>
);

class SampleEntry extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            pendingQuickAnalyze: false
        };
    }

    onClick = () => {
        this.props.onNavigate(this.props.id);
    };

    handleQuickAnalyze = (e) => {
        e.stopPropagation();

        if (this.props.skipDialog) {
            this.props.onAnalyze(this.props.id, this.props.algorithm || "pathoscope_bowtie");
        } else {
            this.props.onQuickAnalyze(this.props.id, this.props.name);
        }
    };

    render () {
        return (
            <div className="list-group-item hoverable spaced" onClick={this.onClick}>
                <Flex alignItems="center">
                    <FlexItem grow={1}>
                        <Row>
                            <Col xs={9} md={4}>
                                <strong>{this.props.name}</strong>
                            </Col>

                            <Col xs={3} md={3}>
                                <SampleEntryLabels {...this.props} />
                            </Col>

                            <Col xs={5} md={4}>
                                <span className="hidden-xs hidden-sm">
                                    Created <RelativeTime time={this.props.created_at} /> by {this.props.userId}
                                </span>
                                <span className="hidden-md hidden-lg">
                                    <Icon name="meter" /> <RelativeTime time={this.props.created_at} />
                                </span>
                            </Col>

                            <Col xs={3} mdHidden lgHidden>
                                <Icon name="user" /> {this.props.userId}
                            </Col>

                            <Col md={1} xsHidden smHidden>
                                <Icon
                                    name="bars"
                                    tip="Quick Analyze"
                                    tipPlacement="left"
                                    bsStyle="success"
                                    onClick={this.handleQuickAnalyze}
                                    style={{fontSize: "17px", zIndex: 10000}}
                                    pullRight
                                />
                            </Col>
                        </Row>
                    </FlexItem>
                </Flex>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    skipDialog: state.account.settings.skip_quick_analyze_dialog,
    algorithm: state.account.settings.quick_analyze_algorithm
});

const mapDispatchToProps = (dispatch) => ({

    onNavigate: (sampleId) => {
        dispatch(push(`/samples/${sampleId}`));
    },

    onAnalyze: (id, algorithm) => {
        dispatch(analyze(id, algorithm));
    },

    onQuickAnalyze: (id, name) => {
        dispatch(push({state: {quickAnalyze: {id, name}}}));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(SampleEntry);

export default Container;

import React from "react";
import CX from "classnames";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { Row, Col } from "react-bootstrap";
import { ClipLoader } from "halogenium";
import { Icon, Flex, FlexItem, RelativeTime, Checkbox } from "../../base";

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
        <SampleEntryLabel icon="archive" label="Import" ready={imported || true} />&nbsp;
        <SampleEntryLabel icon="chart-area" label="Pathoscope" ready={pathoscope} />&nbsp;
        <SampleEntryLabel icon="chart-area" label="NuVs" ready={nuvs} />
    </Flex>
);

class SampleEntry extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            pendingQuickAnalyze: false
        };
    }

    onClick = (e) => {
        if (e.target.nodeName !== "I") {
            this.props.onNavigate(this.props.id);
        }
    };

    handleCheck = (e) => {
        e.preventDefault();
        this.props.onSelect(this.props.index, e.shiftKey);
    };

    handleQuickAnalyze = (e) => {
        e.stopPropagation();
        this.props.quickAnalyze(this.props.id);
    };

    render () {
        return (
            <div className="list-group-item hoverable spaced" onClick={this.onClick}>
                <Flex alignItems="center">
                    <FlexItem grow={1}>
                        <Row>
                            <Col xs={6} md={4}>
                                <Checkbox
                                    className="no-select"
                                    checked={this.props.isChecked}
                                    onClick={this.handleCheck}
                                />
                                <strong>&nbsp;{this.props.name}</strong>
                            </Col>

                            <Col xs={3} md={4}>
                                <SampleEntryLabels {...this.props} />
                            </Col>

                            <Col xs={6} md={3} xsHidden smHidden>
                                Created <RelativeTime time={this.props.created_at} /> by {this.props.userId}
                            </Col>

                            <Col xs={3} md={1}>
                                {this.props.isHidden ? null : (
                                    <Icon
                                        name="chart-area"
                                        tip="Quick Analyze"
                                        tipPlacement="left"
                                        bsStyle="success"
                                        onClick={this.handleQuickAnalyze}
                                        pullRight
                                    />
                                )}
                            </Col>

                            <Col xs={6} md={3} mdHidden lgHidden>
                                <Icon name="clock" /> <RelativeTime time={this.props.created_at} />
                            </Col>

                            <Col xs={3} mdHidden lgHidden>
                                <Icon name="user" /> {this.props.userId}
                            </Col>
                        </Row>
                    </FlexItem>
                </Flex>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    algorithm: state.account.settings.quick_analyze_algorithm
});

const mapDispatchToProps = (dispatch) => ({

    onNavigate: (sampleId) => {
        dispatch(push(`/samples/${sampleId}`));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SampleEntry);

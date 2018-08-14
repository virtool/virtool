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
                {ready === "ip"
                    ? <ClipLoader size="10px" color="white" verticalAlign="middle" />
                    : <Icon name={icon} style={{lineHeight: "inherit"}} />}
                <span style={{paddingLeft: "3px"}} className="hidden-xs hidden-sm">
                    {label}
                </span>
            </Flex>
        </FlexItem>
    </Flex>
);

const SampleEntryLabels = ({ nuvs, pathoscope }) => (
    <Flex style={{height: "20px"}}>
        <SampleEntryLabel icon="chart-area" label="Pathoscope" ready={pathoscope} />&nbsp;
        <SampleEntryLabel icon="chart-area" label="NuVs" ready={nuvs} />
    </Flex>
);

class SampleEntry extends React.Component {

    onClick = (e) => {
        if (e.target.nodeName !== "I") {
            this.props.onNavigate(this.props.id);
        }
    };

    handleCheck = (e) => {
        e.preventDefault();
        this.props.onSelect(this.props.id, this.props.index, e.shiftKey);
    };

    handleQuickAnalyze = (e) => {
        e.stopPropagation();
        this.props.quickAnalyze(this.props.id);
    };

    render () {

        let statusIcon;

        if (this.props.imported === "ip") {
            statusIcon = (
                <Flex alignItems="center" className="pull-right">
                    <ClipLoader size="14px" color="#3c8786" />
                    <FlexItem pad>
                        <strong>Creating</strong>
                    </FlexItem>
                </Flex>
            );
        } else if (!this.props.isHidden) {
            statusIcon = (
                <Icon
                    name="chart-area"
                    tip="Quick Analyze"
                    tipPlacement="left"
                    bsStyle="success"
                    onClick={this.handleQuickAnalyze}
                    style={{fontSize: "17px", zIndex: 10000}}
                    pullRight
                />
            );
        }

        return (
            <div className="list-group-item hoverable spaced" onClick={this.onClick} style={{ color: "#555" }}>
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

                            <Col xs={3} md={3}>
                                <SampleEntryLabels {...this.props} />
                            </Col>

                            <Col xs={6} md={4} xsHidden smHidden>
                                Created <RelativeTime time={this.props.created_at} /> by {this.props.userId}
                            </Col>

                            <Col xs={3} md={1}>
                                {statusIcon}
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

import React from "react";
import CX from "classnames";
import { find, includes } from "lodash-es";
import { push } from "connected-react-router";
import { LinkContainer } from "react-router-bootstrap";
import { connect } from "react-redux";
import { Row, Col } from "react-bootstrap";
import { Icon, Flex, FlexItem, ListGroupItem, RelativeTime, Checkbox, Loader } from "../../base";
import { selectSample } from "../actions";

export const SampleEntryLabel = ({ icon, label, ready }) => (
    <Flex>
        <FlexItem className={CX("sample-label", { "bg-primary": ready })}>
            <Flex alignItems="center">
                <span style={{ width: "12px" }}>
                    {ready === "ip" ? (
                        <Loader size="10px" color="white" verticalAlign="middle" />
                    ) : (
                        <Icon name={icon} style={{ lineHeight: "inherit" }} fixedWidth />
                    )}
                </span>
                <span className="sample-label-text">{label}</span>
            </Flex>
        </FlexItem>
    </Flex>
);

export const SampleEntryLabels = ({ nuvs, pathoscope }) => (
    <Flex style={{ height: "20px" }}>
        <SampleEntryLabel icon="chart-area" label="Pathoscope" ready={pathoscope} />
        &nbsp;
        <SampleEntryLabel icon="chart-area" label="NuVs" ready={nuvs} />
    </Flex>
);

class SampleEntry extends React.Component {
    handleCheck = e => {
        this.props.onSelect(this.props.id, this.props.index, e.shiftKey);
    };

    render() {
        let analyzeIcon;
        let spinner;

        if (this.props.imported === "ip") {
            spinner = (
                <Flex alignItems="center" className="pull-right">
                    <Loader size="14px" color="#3c8786" />
                    <FlexItem pad>
                        <strong>Creating</strong>
                    </FlexItem>
                </Flex>
            );
        } else {
            analyzeIcon = (
                <div className="sample-icon-overlay">
                    <Icon
                        name="chart-area"
                        tip="Quick Analyze"
                        tipPlacement="left"
                        bsStyle="success"
                        onClick={this.props.onQuickAnalyze}
                        style={{ fontSize: "17px", zIndex: 10000 }}
                        pullRight
                    />
                </div>
            );
        }

        return (
            <div className="sample-item-container">
                <div className="sample-checkbox-overlay" onClick={this.handleCheck} />
                {analyzeIcon}
                <LinkContainer to={`/samples/${this.props.id}`}>
                    <ListGroupItem className="spaced">
                        <Flex alignItems="center" style={{ userSelect: "none" }}>
                            <FlexItem grow={1}>
                                <Row>
                                    <Col xs={4} sm={5} md={4}>
                                        <Checkbox
                                            className="no-select"
                                            checked={this.props.checked}
                                            style={{ paddingRight: "12px" }}
                                        />
                                        <strong>{this.props.name}</strong>
                                    </Col>

                                    <Col xsHidden smHidden md={3}>
                                        <SampleEntryLabels {...this.props} />
                                    </Col>

                                    <Col xs={5} sm={5} md={4}>
                                        Created <RelativeTime time={this.props.created_at} /> by {this.props.user.id}
                                    </Col>

                                    <Col xs={3} sm={2} md={1}>
                                        {spinner}
                                    </Col>
                                </Row>
                            </FlexItem>
                        </Flex>
                    </ListGroupItem>
                </LinkContainer>
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => ({
    ...find(state.samples.documents, { id: ownProps.id }),
    checked: includes(state.samples.selected, ownProps.id)
});

const mapDispatchToProps = (dispatch, ownProps) => ({
    onSelect: () => {
        dispatch(selectSample(ownProps.id));
    },
    onQuickAnalyze: () => {
        dispatch(push({ state: { createAnalysis: [ownProps.id] } }));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SampleEntry);

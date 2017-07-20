/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports InternalControlOptions
 */

import React from "react";
import { connect } from "react-redux";
import { Typeahead } from "react-bootstrap-typeahead";
import { Row, Col, Panel } from "react-bootstrap";
import { Flex, FlexItem, Checkbox } from "virtool/js/components/Base";

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
class InternalControl extends React.Component {

    static propTypes = {
        set: React.PropTypes.func,
        useInternalControl: React.PropTypes.bool,
        internalControlId: React.PropTypes.string
    };

    /**
     * Calculates the inputValue (virus name) from the virus id of the current control (controlId). Returns an empty
     * string if no controlId is defined.
     *
     * @func
     */
    getSelected = () => {
        // The id of the virus that is used as an internal control if there is one..
        const controlId = this.props.internalControlId;

        let virus;

        if (controlId) {
            virus = dispatcher.db.viruses.by("_id", controlId);
        }

        let selected = [];

        if (virus) {
            selected.push({
                label: virus.name,
                id: virus._id
            });
        }

        return selected;
    };

    render () {

        return (
            <div>
                <Row>
                    <Col md={6}>
                        <Flex alignItems="center" style={{marginBottom: "10px"}}>
                            <FlexItem grow={1} >
                                <strong>Internal Control</strong>
                            </FlexItem>
                            <FlexItem grow={0} shrink={0}>
                                <Checkbox
                                    label="Enable"
                                    checked={this.props.useInternalControl}
                                    onClick={this.toggle}
                                />
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={6} />
                </Row>
                <Row>
                    <Col md={6}>
                        <Panel>
                            <Typeahead
                                options={["Test"]}
                                onChange={(selected) => this.props.set("internal_control_id", selected[0].id)}
                                disabled={!this.props.useInternalControl}
                            />
                        </Panel>
                    </Col>
                    <Col md={6}>
                        <Panel>
                            Set a virus that is spiked into samples to be used as a positive control. Viral abundances
                            in a sample can be calculated as proportions relative to the control.
                        </Panel>
                    </Col>
                </Row>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        useInternalControl: state.settings.use_internal_control,
        internalControlId: state.settings.internal_control_id
    };
};

const Container = connect(
    mapStateToProps
)(InternalControl);

export default Container;

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
import { find } from "lodash";
import { connect } from "react-redux";
import { Typeahead } from "react-bootstrap-typeahead";
import { Row, Col, Panel } from "react-bootstrap";
import { Flex, FlexItem, Checkbox } from "../../../components/Base";
import { updateSetting, getControlReadahead } from "../../actions";

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
class InternalControl extends React.Component {

    componentWillMount () {
        this.props.onGetReadahead();
    }

    handleChange = (selected) => {
        if (this.props.settings.internal_control_id) {
            return this.props.onUpdate(null);
        }

        return this.props.onUpdate(selected[0].id);
    };

    render () {

        const useInternalControl = this.props.settings.use_internal_control;

        const internalControlId = this.props.settings.internal_control_id;

        let selected;

        if (internalControlId && this.props.readahead) {
            selected = [find(this.props.readahead, {id: internalControlId})];
        }

        return (
            <div>
                <Row>
                    <Col xs={12} md={6}>
                        <Flex alignItems="center" style={{marginBottom: "10px"}}>
                            <FlexItem grow={1} >
                                <strong>Internal Control</strong>
                            </FlexItem>
                            <FlexItem grow={0} shrink={0}>
                                <Checkbox
                                    label="Enable"
                                    checked={useInternalControl}
                                    onClick={() => this.props.onToggle(!useInternalControl)}
                                />
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col smHidden md={6} />
                </Row>
                <Row>
                    <Col xs={12} mdPush={6} md={6}>
                        <Panel>
                            Set a virus that is spiked into samples to be used as a positive control. Viral abundances
                            in a sample can be calculated as proportions relative to the control.
                        </Panel>
                    </Col>
                    <Col xs={12} mdPull={6} md={6}>
                        <Panel>
                            <Typeahead
                                onBlur={() => this.props.onGetReadahead()}
                                onChange={this.handleChange}
                                labelKey="name"
                                selected={selected}
                                options={this.props.readahead || []}
                                disabled={!useInternalControl}
                            />
                        </Panel>
                    </Col>
                </Row>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        settings: state.settings.data,
        readahead: state.settings.readahead,
        readaheadPending: state.settings.readaheadPending
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGetReadahead: (term) => {
            dispatch(getControlReadahead(term));
        },

        onUpdate: (value) => {
            dispatch(updateSetting("internal_control_id", value));
        },

        onToggle: (value) => {
            dispatch(updateSetting("use_internal_control", value));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(InternalControl);

export default Container;

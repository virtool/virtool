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
import { Typeahead } from "react-bootstrap-typeahead";
import { Row, Col, Panel } from "react-bootstrap";
import { Flex, FlexItem, Checkbox } from "virtool/js/components/Base";

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
export default class InternalControlOptions extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            // Set true when the input field has focus.
            focused: false,
            selected: this.getSelected()
        };
    }

    static propTypes = {
        set: React.PropTypes.func,
        settings: React.PropTypes.object
    };

    componentDidMount () {
        dispatcher.db.viruses.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.db.viruses.off("change", this.update);
    }

    /**
     * Calculates the inputValue (virus name) from the virus id of the current control (controlId). Returns an empty
     * string if no controlId is defined.
     *
     * @func
     */
    getSelected = () => {
        // The id of the virus that is used as an internal control if there is one..
        const controlId = this.props.settings.internal_control_id;

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

    /**
     * Toggles use of an internal control. Updates the "use_internal_control" setting value. Triggered by a click event
     * on the "enable this feature" button.
     *
     * @func
     */
    toggle = () => {
        this.props.set("use_internal_control", !this.props.settings.use_internal_control);
    };

    render () {

        const options = dispatcher.db.viruses.chain().find().simplesort("name").data().map(document => ({
            label: document.name,
            id: document._id
        }));

        return (
            <div>
                <Row>
                    <Col md={6}>
                        <Flex alignItems="center" style={{marginBottom: "10px"}}>
                            <FlexItem grow={1} >
                                <strong>Internal Control</strong>
                            </FlexItem>
                            <FlexItem grow={0} shrink={0}>
                                <Checkbox checked={this.props.settings.use_internal_control} onClick={this.toggle} />
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={6} />
                </Row>
                <Row>
                    <Col md={6}>
                        <Panel>
                            <Typeahead
                                options={options}
                                selected={this.state.selected}
                                onChange={(selected) => this.props.set("internal_control_id", selected[0].id)}
                                disabled={!this.props.settings.use_internal_control}
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

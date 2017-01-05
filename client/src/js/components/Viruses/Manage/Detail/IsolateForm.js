/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports IsolateForm
 */

import React from "react";
import { capitalize } from "lodash";
import { Row, Col } from "react-bootstrap";
import { Input } from "virtool/js/components/Base";

/**
 * A form component used to edit and add isolates.
 *
 * @class
 */
export default class IsolateForm extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            sourceType: this.props.sourceType,
            sourceName: this.props.sourceName
        };
    }

    static propTypes = {
        // These props inform initial state. If the form was mounted in order to edit an existing isolate, these props
        // should be defined. Otherwise the will be set to the default "unamed isolate" values.
        sourceType: React.PropTypes.string,
        sourceName: React.PropTypes.string,

        // These props provide the information necessary to show a restricted dropdown list of potential sourceTypes.
        allowedSourceTypes: React.PropTypes.arrayOf(React.PropTypes.string),
        restrictSourceTypes: React.PropTypes.bool,

        onChange: React.PropTypes.func.isRequired,
        onSubmit: React.PropTypes.func.isRequired
    };

    static defaultProps = {
        sourceType: "unknown",
        sourceName: "",
        edit: true,
        restrictSourceTypes: false
    };

    componentDidMount () {
        // Focus on the source type input when the component mounts.
        this.refs.sourceType.focus();
    }

    /**
     * Called when a change occurs in the sourceType input. Updates the sourceType state value. If the new value is
     * "unknown", the sourceName is forced to an empty string.
     *
     * @func
     */
    handleChange = (event) => {
        if (event.target.name === "sourceType") {
            this.props.onChange({
                sourceType: event.target.value.toLowerCase(),
                sourceName: event.target.value === "unknown" ? "": this.props.sourceName
            });
        }

        if (event.target.name === "sourceName") {
            this.props.onChange({
                sourceName: event.target.value
            });
        }
    };

    focus = () => {
        this.refs.sourceType.focus();
    };

    render () {

        let sourceTypeInput;

        const sourceTypeInputProps = {
            ref: "sourceType",
            name: "sourceType",
            label: "Source Type",
            value: this.props.sourceType,
            onChange: this.handleChange
        };

        // If the is a restricted list of sourceTypes to choose from display a select field with the choices.
        if (dispatcher.settings.get("restrict_source_types")) {
            const optionComponents = dispatcher.settings.get("allowed_source_types").map((sourceType, index) =>
                <option key={index} value={sourceType}>{capitalize(sourceType)}</option>
            );

            sourceTypeInput = (
                <Input type="select" {...sourceTypeInputProps}>
                    <option key="default" value="unknown">Unknown</option>
                    {optionComponents}
                </Input>
            );
        } else {
            sourceTypeInput = <Input type="text" {...sourceTypeInputProps} />;
        }

        return (
            <form onSubmit={this.props.onSubmit}>
                <Row>
                    <Col md={6}>
                        {sourceTypeInput}
                    </Col>
                    <Col md={6}>
                        <Input
                            type="text"
                            name="sourceName"
                            label="Source Name"
                            value={this.props.sourceName}
                            onChange={this.handleChange}
                            disabled={this.props.sourceType === "unknown"}
                            spellCheck="off"
                        />
                    </Col>
                </Row>
            </form>
        );
    }
}

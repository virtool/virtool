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

import React, { PropTypes } from "react";
import { capitalize } from "lodash";
import { Row, Col } from "react-bootstrap";

import { formatIsolateName } from "virtool/js/utils";
import { Input } from "virtool/js/components/Base";

export default class IsolateForm extends React.Component {

    static propTypes = {
        sourceType: PropTypes.string,
        sourceName: PropTypes.string,
        allowedSourceTypes: PropTypes.arrayOf(React.PropTypes.string),
        restrictSourceTypes: PropTypes.bool,
        onChange: PropTypes.func,
        onSubmit: PropTypes.func
    };

    focus = () => {
        this.sourceTypeNode.focus();
    };

    changeSourceType = (event) => {
        this.props.onChange({
            sourceType: event.target.value.toLowerCase(),
            sourceName: event.target.value === "unknown" ? "": this.props.sourceName
        });
    };

    changeSourceName = (event) => {
        this.props.onChange({
            sourceName: event.target.value,
            sourceType: this.props.sourceType
        })
    };

    render () {

        let sourceTypeInput;

        const sourceTypeInputProps = {
            ref: (node) => this.sourceTypeNode = node,
            label: "Source Type",
            value: this.props.sourceType,
            onChange: this.changeSourceType
        };

        // If the is a restricted list of sourceTypes to choose from display a select field with the choices.
        if (this.props.restrictSourceTypes) {
            const optionComponents = this.props.allowedSourceTypes.map(sourceType =>
                <option key={sourceType} value={sourceType}>
                    {capitalize(sourceType)}
                </option>
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
                            label="Source Name"
                            value={this.props.sourceName}
                            onChange={this.changeSourceName}
                            disabled={this.props.sourceType === "unknown"}
                            spellCheck="off"
                        />
                    </Col>
                    <Col md={12}>
                        <Input
                            label="Isolate Name"
                            value={formatIsolateName(this.props)}
                            readOnly
                        />
                    </Col>
                </Row>
            </form>
        );
    }
}

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
import PropTypes from "prop-types";
import { map, toLower } from "lodash-es";
import { Row, Col, Modal } from "react-bootstrap";

import { formatIsolateName } from "../../../utils/utils";
import { InputError, SaveButton } from "../../../base";

export default class IsolateForm extends React.Component {
    static propTypes = {
        sourceType: PropTypes.string,
        sourceName: PropTypes.string,
        allowedSourceTypes: PropTypes.arrayOf(PropTypes.string),
        restrictSourceTypes: PropTypes.bool,
        onChange: PropTypes.func,
        onSubmit: PropTypes.func
    };

    changeSourceType = e => {
        this.props.onChange({
            sourceType: toLower(e.target.value),
            sourceName: e.target.value === "unknown" ? "" : this.props.sourceName
        });
    };

    changeSourceName = e => {
        this.props.onChange({
            sourceName: e.target.value,
            sourceType: this.props.sourceType
        });
    };

    render() {
        let sourceTypeInput;

        const sourceTypeInputProps = {
            label: "Source Type",
            value: this.props.sourceType,
            onChange: this.changeSourceType
        };

        // If the is a restricted list of sourceTypes to choose from display a select field with the choices.
        if (this.props.restrictSourceTypes) {
            const optionComponents = map(this.props.allowedSourceTypes, sourceType => (
                <option key={sourceType} value={sourceType} className="text-capitalize">
                    {sourceType}
                </option>
            ));

            sourceTypeInput = (
                <InputError type="select" {...sourceTypeInputProps}>
                    <option key="default" value="unknown">
                        Unknown
                    </option>
                    {optionComponents}
                </InputError>
            );
        } else {
            sourceTypeInput = <InputError type="text" {...sourceTypeInputProps} />;
        }

        return (
            <form onSubmit={this.props.onSubmit}>
                <Modal.Body>
                    <Row>
                        <Col md={6}>{sourceTypeInput}</Col>
                        <Col md={6}>
                            <InputError
                                label="Source Name"
                                value={this.props.sourceName}
                                onChange={this.changeSourceName}
                                disabled={this.props.sourceType === "unknown"}
                                spellCheck="off"
                            />
                        </Col>
                        <Col md={12}>
                            <InputError label="Isolate Name" value={formatIsolateName(this.props)} readOnly />
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <SaveButton />
                </Modal.Footer>
            </form>
        );
    }
}

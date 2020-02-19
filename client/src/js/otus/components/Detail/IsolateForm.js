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
import { toLower } from "lodash-es";
import styled from "styled-components";

import { formatIsolateName } from "../../../utils/utils";
import { InputError, SaveButton, DialogFooter, DialogBody } from "../../../base";
import { SourceTypeInput } from "./SourceTypeInput";

const IsolateFormFields = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 16px;
`;

export class IsolateForm extends React.Component {
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
        // If the is a restricted list of sourceTypes to choose from display a select field with the choices.
        return (
            <form onSubmit={this.props.onSubmit}>
                <DialogBody>
                    <IsolateFormFields>
                        <SourceTypeInput
                            restrictSourceTypes={this.props.restrictSourceTypes}
                            allowedSourceTypes={this.props.allowedSourceTypes}
                            value={this.props.sourceType}
                            onChange={this.changeSourceType}
                        />

                        <InputError
                            label="Source Name"
                            value={this.props.sourceName}
                            onChange={this.changeSourceName}
                            disabled={this.props.sourceType === "unknown"}
                            spellCheck="off"
                        />
                    </IsolateFormFields>

                    <InputError label="Isolate Name" value={formatIsolateName(this.props)} readOnly />
                </DialogBody>
                <DialogFooter>
                    <SaveButton />
                </DialogFooter>
            </form>
        );
    }
}

export default IsolateForm;

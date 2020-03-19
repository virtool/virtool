import { toLower } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { DialogBody, DialogFooter, Input, InputGroup, InputLabel, SaveButton } from "../../../base";

import { formatIsolateName } from "../../../utils/utils";
import { SourceType } from "./SourceType";

const IsolateFormFields = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-column-gap: 15px;
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

    handleChangeSourceType = e => {
        this.props.onChange({
            sourceType: toLower(e.target.value),
            sourceName: e.target.value === "unknown" ? "" : this.props.sourceName
        });
    };

    handleChangeSourceName = e => {
        this.props.onChange({
            sourceName: e.target.value,
            sourceType: this.props.sourceType
        });
    };

    render() {
        return (
            <form onSubmit={this.props.onSubmit}>
                <DialogBody>
                    <IsolateFormFields>
                        <SourceType
                            restrictSourceTypes={this.props.restrictSourceTypes}
                            allowedSourceTypes={this.props.allowedSourceTypes}
                            value={this.props.sourceType}
                            onChange={this.handleChangeSourceType}
                        />

                        <InputGroup>
                            <InputLabel>Source Name</InputLabel>
                            <Input
                                value={this.props.sourceName}
                                onChange={this.handleChangeSourceName}
                                disabled={this.props.sourceType === "unknown"}
                            />
                        </InputGroup>
                    </IsolateFormFields>

                    <InputGroup>
                        <InputLabel>Isolate Name</InputLabel>
                        <Input value={formatIsolateName(this.props)} readOnly />
                    </InputGroup>
                </DialogBody>
                <DialogFooter>
                    <SaveButton />
                </DialogFooter>
            </form>
        );
    }
}

export default IsolateForm;

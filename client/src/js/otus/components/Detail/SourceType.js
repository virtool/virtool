import { capitalize, map } from "lodash-es";
import React from "react";
import { Input, InputGroup, InputLabel, Select } from "../../../base";

export const SourceType = ({ restrictSourceTypes, allowedSourceTypes, value, onChange }) => {
    if (restrictSourceTypes) {
        const optionComponents = map(allowedSourceTypes, sourceType => (
            <option key={sourceType} value={capitalize(sourceType)}>
                {capitalize(sourceType)}
            </option>
        ));

        return (
            <InputGroup>
                <InputLabel>Source Type</InputLabel>
                <Select value={capitalize(value)} onChange={onChange}>
                    <option key="default" value="unknown">
                        Unknown
                    </option>
                    {optionComponents}
                </Select>
            </InputGroup>
        );
    }

    return (
        <InputGroup>
            <InputLabel>Source type</InputLabel>
            <Input value={capitalize(value)} onChange={onChange} />
        </InputGroup>
    );
};

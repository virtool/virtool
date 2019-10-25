import React from "react";
import { capitalize, map } from "lodash-es";
import { InputError } from "../../../base";

export const SourceTypeInput = ({ restrictSourceTypes, allowedSourceTypes, value, onChange }) => {
    const sourceTypeInputProps = {
        label: "Source Type",
        value: capitalize(value),
        onChange
    };

    if (restrictSourceTypes) {
        const optionComponents = map(allowedSourceTypes, sourceType => (
            <option key={sourceType} value={capitalize(sourceType)}>
                {capitalize(sourceType)}
            </option>
        ));

        return (
            <InputError type="select" {...sourceTypeInputProps}>
                <option key="default" value="unknown">
                    Unknown
                </option>
                {optionComponents}
            </InputError>
        );
    }

    return <InputError type="text" {...sourceTypeInputProps} />;
};

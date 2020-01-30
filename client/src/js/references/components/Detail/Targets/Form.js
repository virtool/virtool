import React from "react";
import { Input, Checkbox } from "../../../../base";

export const TargetForm = ({ onChange, name, description, length, required, onClick }) => {
    return (
        <div>
            <Input label="Name" name="name" value={name} onChange={onChange} />
            <Input label="Description" name="description" value={description} onChange={onChange} />
            <Input type="number" label="Length" name="length" value={length} onChange={onChange} />

            <Checkbox label="Required" checked={required} onClick={onClick} />
        </div>
    );
};

import { useEffect, useState } from "react";

export const useCreateAnalysis = (dataType, defaultSubtraction) => {
    const [errors, setErrors] = useState({});
    const [references, setReferences] = useState([]);
    const [subtraction, setSubtraction] = useState(defaultSubtraction);
    const [workflows, setWorkflows] = useState([]);

    const setReferencesAndError = references => {
        setReferences(references);
        setErrors({
            ...errors,
            references: false
        });
    };

    const setWorkflowsAndError = workflows => {
        setWorkflows(workflows);
        setErrors({
            ...errors,
            workflows: false
        });
    };

    useEffect(() => {
        setErrors({});
        setReferences([]);
        setWorkflows([]);
    }, [dataType]);

    return {
        errors,
        references,
        subtraction,
        workflows,
        setErrors,
        setReferences: setReferencesAndError,
        setSubtraction,
        setWorkflows: setWorkflowsAndError
    };
};

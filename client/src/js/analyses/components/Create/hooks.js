import { useEffect, useState } from "react";

export const useCreateAnalysis = (dataType, defaultSubtractions) => {
    const [errors, setErrors] = useState({});
    const [references, setReferences] = useState([]);
    const [subtractions, setSubtractions] = useState(defaultSubtractions);
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
        subtractions,
        workflows,
        setErrors,
        setReferences: setReferencesAndError,
        setSubtractions,
        setWorkflows: setWorkflowsAndError
    };
};

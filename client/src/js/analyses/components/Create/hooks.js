import { xor, xorBy } from "lodash-es";
import { useEffect, useState } from "react";

export const useCreateAnalysis = (dataType, defaultSubtraction) => {
    const [error, setError] = useState("");
    const [indexes, setIndexes] = useState([]);
    const [subtraction, setSubtraction] = useState(defaultSubtraction);
    const [workflows, setWorkflows] = useState([]);

    const toggleIndex = index => {
        setIndexes(prev => xorBy(prev, [index], "id"));
        setError("");
    };

    const toggleWorkflow = workflow => {
        setWorkflows(xor(workflows, [workflow]));
    };

    useEffect(() => {
        setIndexes([]);
        setWorkflows([]);
    }, [dataType]);

    return {
        error,
        indexes,
        subtraction,
        workflows,
        setError,
        setSubtraction,
        toggleIndex,
        toggleWorkflow
    };
};

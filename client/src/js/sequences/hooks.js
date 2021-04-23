import { useCallback, useEffect, useState } from "react";

/**
 * A hook for storing and updating sequence form state.
 *
 * Form data is stored as an object called `data`. Partial updates can be applied using the returned `updateData()`
 * callback function.
 *
 * @param accession {string} the accession for the sequence
 * @param definition {string} the Genbank-like definition for the sequence
 * @param host {string} the host for the sequence as would be found in the Genbank features
 * @param sequence {string} the nucleotide sequence
 * @returns {{data: {sequence: string, host: string, definition: string, accession: string}, updateData: (function(*): void)}}
 */
export const useSequenceData = ({ accession, definition, host, sequence }) => {
    const [data, setData] = useState({
        accession: "",
        definition: "",
        host: "",
        sequence: ""
    });

    useEffect(
        () =>
            setData({
                accession: accession || "",
                definition: definition || "",
                host: host || "",
                sequence: sequence || ""
            }),
        [accession, definition, host, sequence]
    );

    const updateData = update => setData(data => ({ ...data, ...update }));

    return { data, updateData };
};

/**
 * A hook for managing sequence detail visibility.
 *
 * Provides a `expanded` boolean indicating visibility and functions for setting visibility: `expand()` and
 * `collapse()`.
 *
 * @returns {[boolean, (function(): void), (function(): void)]}
 */
export const useExpanded = () => {
    const [expanded, setExpanded] = useState(false);

    let expand;

    if (!expanded) {
        expand = () => setExpanded(true);
    }

    const collapse = useCallback(() => {
        setExpanded(false);
    }, [expanded]);

    return { expanded, expand, collapse };
};

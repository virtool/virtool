import React, { useEffect, useState } from "react";
import { Input, InputContainer, InputError, InputGroup, InputIcon, InputLabel, InputLoading } from "../../base";
import { getGenbank } from "../../otus/api";

export const Accession = ({ accession, error, onChange, onAutofill }) => {
    const [pending, setPending] = useState(false);
    const [sent, setSent] = useState(false);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (pending && !sent) {
            setSent(true);

            getGenbank(accession).then(
                resp => {
                    const { accession, definition, host, sequence } = resp.body;

                    onAutofill({
                        accession,
                        definition,
                        host,
                        sequence
                    });

                    setPending(false);
                    setSent(false);
                    setNotFound(false);
                },
                err => {
                    setPending(false);
                    setSent(true);
                    setNotFound(err.status === 404);

                    return err;
                }
            );
        }
    }, [accession, pending, notFound, onAutofill, onChange]);

    const handleChange = e => {
        setNotFound(false);
        onChange(e);
    };

    return (
        <InputGroup>
            <InputLabel>Accession (ID)</InputLabel>
            <InputContainer align="right">
                <Input name="accession" value={accession} onChange={handleChange} />
                {pending ? <InputLoading /> : <InputIcon name="magic" onClick={() => setPending(true)} />}
            </InputContainer>
            <InputError>{notFound ? "Accession not found" : error}</InputError>
        </InputGroup>
    );
};

import React from "react";

import { ExternalLink } from "../../base";

export const ClusterMember = ({ index, accession, name, organism }) => (
    <tr key={index}>
        <td>
            <ExternalLink
                href={`http://www.ncbi.nlm.nih.gov/protein/${accession}`}
                target="_blank"
                rel="noopener noreferrer"
            >
                {accession}
            </ExternalLink>
        </td>
        <td>{name}</td>
        <td>{organism}</td>
    </tr>
);

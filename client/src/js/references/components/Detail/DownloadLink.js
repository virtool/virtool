import React from "react";

export const DownloadLink = ({ id }) => (
    <a href={`/download/indexes/${id}`} download>
        Download Index
    </a>
);

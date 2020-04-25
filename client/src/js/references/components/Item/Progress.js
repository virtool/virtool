import React from "react";
import { AffixedProgressBar } from "../../../base";

export const ReferenceItemProgress = ({ now }) => {
    if (now < 100) {
        return <AffixedProgressBar color="green" now={now} bottom />;
    }

    return null;
};

import Numeral from "numeral";
import { sampleSize, get, startCase, capitalize } from "lodash";

export const taskDisplayNames = {
    nuvs: "NuVs",
    pathoscope_bowtie: "PathoscopeBowtie",
    pathoscope_snap: "PathoscopeSNAP"
};

export const getTaskDisplayName = (taskPrefix) => get(taskDisplayNames, taskPrefix, startCase(taskPrefix));

export const numberDictionary = {
    0: "zero",
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine"
};

const alphanumeric = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const createRandomString = (length=8) => {
    return sampleSize(alphanumeric, length).join("")
};

export const numberToWord = (number) => numberDictionary[Number(number)] || number;

export const byteSize = bytes => Numeral(bytes).format("0.0 b");

export const toScientificNotation = (number) => {
    if (number < 0.01 || number > 1000) {
        const split = number.toExponential().split("e");
        const exponent = split[1].replace("+", "");
        return Numeral(split[0]).format("0.00") + "ₑ" + exponent;
    }

    return Numeral(number).format("0.000");
};

export const formatIsolateName = (isolate) => {
    if (
        isolate.source_type && isolate.source_type !== "unknown" ||
        isolate.sourceType && isolate.sourceType !== "unknown"
    ) {
        return (
            capitalize(isolate.source_type || isolate.sourceType) + " "
            + (isolate.source_name || isolate.sourceName)
        );
    }

    return "Unnamed";
};

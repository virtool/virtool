import { get } from "lodash-es";

export const theme = {
    borderRadius: {
        sm: "2px",
        lg: "4px"
    },
    boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        sm: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
    },
    color: {
        black: "#000000",
        blue: "#3182CE",
        blueDark: "#2B6CB0",
        blueDarkest: "#2C5282",
        blueLight: "#63B3ED",
        blueLightest: "#BEE3F8",
        green: "#48BB78",
        greenDark: "#38A169",
        greenDarkest: "#2F855A",
        greenLight: "#68D391",
        greenLightest: "#C6F6D5",
        grey: "#A0AEC0",
        greyDark: "#718096",
        greyDarkest: "#4A5568",
        greyLight: "#CBD5E0",
        greyLightest: "#E2E8F0",
        orange: "#F6AD55",
        orangeLight: "#FBD38D",
        orangeLightest: "#FEEBC8",
        orangeDark: "#ED8936",
        orangeDarkest: "#DD6B20",
        primary: "#3c8786",
        purple: "#9F7AEA",
        purpleDark: "#805AD5",
        purpleDarkest: "#553C9A",
        purpleLight: "#D6BCFA",
        purpleLightest: "#FAF5FF",
        red: "#E53E3E",
        redDark: "#C53030",
        redDarkest: "#9B2C2C",
        redLight: "#FC8181",
        redLightest: "#FED7D7",
        white: "#fff"
    },
    fontSize: {
        xs: "10px",
        sm: "12px",
        md: "14px",
        lg: "16px"
    },
    gap: {
        column: "15px"
    }
};

export const getColor = ({ color, theme }) => get(theme, ["color", color]);

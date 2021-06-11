import { get } from "lodash-es";

export const colors = ["blue", "green", "grey", "orange", "purple", "red"];

export const theme = {
    borderRadius: {
        sm: "3px",
        md: "6px",
        lg: "10px"
    },
    boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        sm: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        input: "inset 0 1px 1px rgba(0, 0, 0, 0.075);",
        inset: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)"
    },
    color: {
        black: "#000000",
        blue: "#0B7FE5",
        blueDark: "#0862C4",
        blueDarkest: "#033384",
        blueLight: "#6AC4F7",
        blueLightest: "#CDF1FD",
        green: "#1DAD57",
        greenDark: "#159455",
        greenDarkest: "#096449",
        greenLight: "#73E68A",
        greenLightest: "#D1FAD1",
        grey: "#A0AEC0",
        greyDark: "#718096",
        greyDarkest: "#4A5568",
        greyLight: "#CBD5E0",
        greyLightest: "#EDF2F7",
        greyHover: "#F7FAFC",
        orange: "#F7A000",
        orangeLight: "#FCD265",
        orangeLightest: "#FEF4CB",
        orangeDark: "#D48100",
        orangeDarkest: "#B16600",
        primary: "#3C8786",
        primaryDark: "#2B6E74",
        primaryDarkest: "#1E5661",
        primaryLight: "#6AB7AF",
        primaryLightest: "#E8F5F5",
        purple: "#9F7AEA",
        purpleDark: "#805AD5",
        purpleDarkest: "#553C9A",
        purpleLight: "#D6BCFA",
        purpleLightest: "#FAF5FF",
        red: "#E0282E",
        redDark: "#C01D30",
        redDarkest: "#A11431",
        redLight: "#F58E7C",
        redLightest: "#FDE1D3",
        white: "#fff",
        yellow: "#FFE030",
        yellowLight: "#FFF082",
        yellowLightest: "#FFFBD5",
        yellowDark: "#DBBC23",
        yellowDarkest: "#B79A18"
    },
    fontSize: {
        xs: "10px",
        sm: "12px",
        md: "14px",
        lg: "16px",
        xl: "24px",
        xxl: "32px"
    },
    fontWeight: {
        normal: 400,
        thick: 500,
        bold: 700
    },
    gap: {
        column: "15px"
    },
    ring: {
        sm: "0 0 0 2px",
        md: "0 0 0 5px"
    }
};

export const getRing = color => ({ theme }) => `${theme.ring.sm} ${theme.color[color]}`;

export const getActiveShadow = ({ active, theme }) => (active ? `inset 3px 0 0 ${theme.color.primary}` : "none");

export const getBorder = ({ theme }) => `1px solid ${theme.color.greyLight}`;

export const getColor = ({ color, theme }) => get(theme, ["color", color]);

export const getFontSize = size => ({ theme }) => theme.fontSize[size];

export const getFontWeight = weight => ({ theme }) => theme.fontWeight[weight];

export const border = getBorder;

export const borderRadius = {
    sm: ({ theme }) => theme.borderRadius.sm,
    md: ({ theme }) => theme.borderRadius.md,
    lg: ({ theme }) => theme.borderRadius.lg
};

export const boxShadow = {
    xs: ({ theme }) => theme.boxShadow.xs,
    sm: ({ theme }) => theme.boxShadow.sm,
    md: ({ theme }) => theme.boxShadow.md,
    lg: ({ theme }) => theme.boxShadow.lg,
    input: ({ theme }) => theme.boxShadow.input,
    inset: ({ theme }) => theme.boxShadow.inset
};

export const fontWeight = {
    normal: ({ theme }) => theme.fontWeight.normal,
    thick: ({ theme }) => theme.fontWeight.thick,
    bold: ({ theme }) => theme.fontWeight.bold
};

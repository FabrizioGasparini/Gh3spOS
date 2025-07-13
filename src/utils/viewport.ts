export const pxToPercent = (px: number, axis: "x" | "y" = "x"): number => {
    const dimension = axis === "x" ? window.innerWidth : window.innerHeight;
    return (px / dimension) * 100;
};

export const percentToPx = (percent: number, axis: "x" | "y" = "x"): number => {
    const dimension = axis === "x" ? window.innerWidth : window.innerHeight;
    return (percent / 100) * dimension;
};

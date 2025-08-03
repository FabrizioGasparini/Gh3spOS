import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                mono: ['"JetBrains Mono"', "Menlo", "monospace"],
            },
        },
    },
    plugins: [],
};
export default config;

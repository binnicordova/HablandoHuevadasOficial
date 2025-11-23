module.exports = (api) => {
    api.cache(true);
    return {
        presets: ["babel-preset-expo"],
        plugins: [
            [
                "module-resolver",
                {
                    root: ["."],
                    alias: {
                        "@": "./src",
                        "@assets": "./assets",
                    },
                },
            ],
            ["babel-plugin-react-docgen-typescript", {exclude: "node_modules"}],
        ],
    };
};

const eslintConfig = {
  root: true,
  extends: ["next/core-web-vitals"],
  rules: {
    "react-hooks/exhaustive-deps": "warn",
  },
};

module.exports = eslintConfig;
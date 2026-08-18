import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["supabase/migrations/**"],
  },
];

export default eslintConfig;

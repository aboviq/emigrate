const commitlintConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 128],
    'body-max-line-length': [2, 'always', 256],
    'footer-max-line-length': [2, 'always', 256],
  },
};

export default commitlintConfig;

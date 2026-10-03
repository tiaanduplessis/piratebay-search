module.exports = {
  root: true,
  extends: require.resolve('standard/eslintrc.json'),
  overrides: [
    {
      files: ['src/index.js'],
      rules: {
        'object-curly-spacing': ['error', 'never'],
        'quote-props': ['error', 'consistent']
      }
    }
  ]
}

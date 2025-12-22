import next from 'eslint-config-next/core-web-vitals.js'

const config = next.map((entry) => {
  if (entry?.name !== 'next/typescript') return entry

  return {
    ...entry,
    rules: {
      ...entry.rules,
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
          destructuredArrayIgnorePattern: '^_',
          vars: 'all',
          varsIgnorePattern: '^_',
        },
      ],
    },
  }
})

export default [...config, { ignores: ['.next/', '.open-next/', 'node_modules/', 'out/', 'next-env.d.ts'] }]

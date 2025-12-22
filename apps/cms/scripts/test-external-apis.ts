/**
 * Test script for external API clients
 * Usage: pnpm tsx scripts/test-external-apis.ts
 */

import 'dotenv/config'

import {
  isSoaxConfigured,
  isKeywordsEverywhereConfigured,
  isLlmConfigured,
  getAvailableModels,
} from '../src/lib/external'

async function main() {
  console.log('🔍 Testing External API Configuration\n')

  // Check configuration
  console.log('📋 Configuration Status:')
  const soax = isSoaxConfigured()
  const ke = isKeywordsEverywhereConfigured()
  const llm = isLlmConfigured()

  console.log(`  SOAX Scraping: ${soax.scraping ? '✓' : '✗'}`)
  console.log(`  SOAX SERP:     ${soax.serp ? '✓' : '✗'}`)
  console.log(`  Keywords Everywhere: ${ke ? '✓' : '✗'}`)
  console.log(`  LLM API:       ${llm ? '✓' : '✗'}`)

  if (llm) {
    const models = getAvailableModels()
    console.log(`\n  LLM Models:`)
    console.log(`    Analysis:  ${models.analysis}`)
    console.log(`    Creative:  ${models.creative}`)
  }

  console.log('\n' + '='.repeat(60))

  // Test SOAX (if configured)
  if (soax.scraping || soax.serp) {
    console.log('\n🌐 Testing SOAX APIs...')

    if (soax.serp) {
      try {
        const { searchGoogleShopping } = await import('../src/lib/external/soaxClient')
        console.log('  Testing SERP API (Google Shopping)...')
        const result = await searchGoogleShopping('test', { num: 1 })
        console.log(`  ✓ SERP API working (${result.shopping_results?.length || 0} results)`)
      } catch (error) {
        console.log(`  ✗ SERP API failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (soax.scraping) {
      try {
        const { fetchWebContent } = await import('../src/lib/external/soaxClient')
        console.log('  Testing Scraping API...')
        const result = await fetchWebContent('https://example.com')
        console.log(`  ${result.success ? '✓' : '✗'} Scraping API ${result.success ? 'working' : 'failed'}`)
      } catch (error) {
        console.log(`  ✗ Scraping API failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } else {
    console.log('\n⚠️  SOAX APIs not configured (skipping tests)')
  }

  console.log('\n' + '='.repeat(60))

  // Test Keywords Everywhere (if configured)
  if (ke) {
    console.log('\n🔑 Testing Keywords Everywhere API...')

    try {
      const { getKeywordData } = await import('../src/lib/external/keywordsEverywhereClient')
      console.log('  Testing keyword data...')
      const result = await getKeywordData(['test'])
      console.log(`  ${result.success ? '✓' : '✗'} Keywords Everywhere ${result.success ? 'working' : 'failed'}`)
      if (result.success && result.data && result.data.length > 0) {
        const kw = result.data[0]
        console.log(`    - Keyword: ${kw.keyword}`)
        console.log(`    - Volume: ${kw.vol}`)
        console.log(`    - Credits used: ${result.credits_used || 0}`)
      }
    } catch (error) {
      console.log(`  ✗ Keywords Everywhere failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    console.log('\n⚠️  Keywords Everywhere API not configured (skipping tests)')
  }

  console.log('\n' + '='.repeat(60))

  // Test LLM API (if configured)
  if (llm) {
    console.log('\n🤖 Testing LLM API...')

    try {
      const { chat } = await import('../src/lib/external/llmClient')
      console.log('  Testing chat completion...')
      const response = await chat(
        [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "Hello, RankSheet!" in 5 words or less.' },
        ],
        {
          maxTokens: 50,
          temperature: 0.5,
        }
      )
      console.log(`  ✓ LLM API working`)
      console.log(`    Response: ${response.trim()}`)
    } catch (error) {
      console.log(`  ✗ LLM API failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    console.log('\n⚠️  LLM API not configured (skipping tests)')
  }

  console.log('\n' + '='.repeat(60))

  // Summary
  const allConfigured = soax.scraping && soax.serp && ke && llm
  console.log('\n📊 Summary:')
  console.log(`  Status: ${allConfigured ? '✓ All APIs configured' : '⚠️  Some APIs not configured'}`)
  console.log('\n💡 To configure missing APIs, update your .env.local file.')
  console.log('   See .env.example for reference.\n')
}

main().catch((error) => {
  console.error('❌ Test script failed:', error)
  process.exit(1)
})

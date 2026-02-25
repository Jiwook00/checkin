import { createClient } from '@supabase/supabase-js'
import { detectSourceType, extractNotionPageId } from './url-utils.ts'
import { parseBlog } from './blog-parser.ts'
import { parseNotion } from './notion-parser.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { title, author, source_url, session } = await req.json()

    // 입력 검증
    if (!author || !source_url || !session) {
      return new Response(
        JSON.stringify({ success: false, error: '필수 필드가 누락되었습니다 (author, source_url, session)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // URL 타입 판별
    const sourceType = detectSourceType(source_url)

    // 콘텐츠 파싱
    let parsed: { title: string; content_html: string; content_markdown: string }

    if (sourceType === 'notion') {
      const pageId = extractNotionPageId(source_url)
      if (!pageId) {
        return new Response(
          JSON.stringify({ success: false, error: '노션 페이지 ID를 추출할 수 없습니다' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      parsed = await parseNotion(pageId)
    } else {
      parsed = await parseBlog(source_url)
    }

    // 제목: 사용자 입력 우선, 없으면 파싱된 제목 사용
    const finalTitle = title?.trim() || parsed.title

    // Supabase에 저장
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase
      .from('retrospectives')
      .insert({
        title: finalTitle,
        author,
        source_url,
        source_type: sourceType,
        content_html: parsed.content_html,
        content_markdown: parsed.content_markdown,
        session,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`DB 저장 실패: ${error.message}`)
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

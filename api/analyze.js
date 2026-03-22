const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.body || {};
  if (!address) return res.status(400).json({ error: '주소를 입력해주세요' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다' });

  const prompt = `당신은 한국 부동산 건물 매물 전문 분석가입니다.

아래 주소의 건물에 대해 한줄 매물 노트를 작성해주세요.
주소: ${address}

해당 지역의 특성, 시세, 상권, 교통 등을 전문가 관점에서 추정하여 작성하세요.
모르는 항목은 "확인 필요" 또는 "정보 없음"으로 표기하세요.

아래 JSON 형식으로만 응답하세요. 마크다운 없이 순수 JSON:

{
  "소재지": "동/번지 형식",
  "준공년도": "YYYY.MM 또는 YYYY년",
  "구조": "건물 구조",
  "용도지역": "용도지역",
  "연면적": "XX평 (XX㎡)",
  "층수": "지상 N층 (지하 N층, 주차 N대 등)",
  "접근성": "가장 가까운 역/버스 도보 시간 및 교통 특성",
  "주변상권": "상권 특성 및 유동인구 설명",
  "개발호재": "개발 예정/호재 또는 없음",
  "매매가": "XX억",
  "평당단가": "XX만원",
  "시세": "XX억",
  "가격판단": "적정",
  "최근실거래": "YYYY.MM / XX억 또는 정보 없음",
  "거래량3년": "XX건",
  "비교사례": "인근 유사 건물 거래 사례",
  "임대구성": "층별 임대 현황",
  "공실": "없음",
  "시세임대료": "보증금 XX / 월 XX만원",
  "근저당": "없음",
  "위반건축": "없음",
  "외관변화": "변화 없음",
  "투자요약": "투자 관점 요약",
  "리스크": "주요 리스크",
  "기회": "투자 기회"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(500).json({ error: err.error?.message || 'API 오류 ' + response.status });
    }

    const result = await response.json();
    let text = '';
    for (const b of (result.content || [])) {
      if (b.type === 'text') text = b.text;
    }
    if (!text) return res.status(500).json({ error: 'AI 응답이 비어있습니다' });

    const match = text.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: '응답 파싱 실패' });

    const data = JSON.parse(match[0]);
    return res.status(200).json({ success: true, data });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

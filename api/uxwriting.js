// Vercel 서버 함수: UX 라이팅 문구를 Gemini에게 대신 주문하는 창구예요. (UXwriting.html 이 써요)
// 키는 Vercel 환경 변수 GEMINI_API_KEY 에만 있고, 브라우저에는 절대 보내지 않아요.
//
// 쓰는 법: POST /api/uxwriting   본문 {"query":"결제 실패, 다정하게","types":["button","error"],"tone":"auto"}
//
// 주문서(프롬프트)는 여기서 만들어요. 화면은 상황·유형·톤만 보내요.
// 그래야 이 창구가 아무 질문이나 대신 해 주는 "공짜 Gemini"가 되지 않아요.

// 기본은 lite 모델: gemini-3.8-flash 무료 등급은 하루 20번뿐이라 공개 화면에는 모자라요. 바꾸려면 Vercel 환경 변수 GEMINI_MODEL.
const MODEL = (process.env.GEMINI_MODEL || "gemini-3.5-flash-lite").trim();
const BASE = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;

// 허락한 유형·톤만 받아요.
const TYPE_NAME = { button: "버튼", error: "에러", empty: "빈 화면", toast: "토스트", confirm: "확인창" };
const TONES = ["auto", "친근한", "정중한", "단호한", "위트 있는"];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function buildPrompt(query, types, tone) {
  return `당신은 경력 20년 차 시니어 UX 라이터입니다. 토스·애플·구글·에어비앤비 수준의 마이크로카피를 씁니다.

원칙:
- 사용자가 지금 무엇을 하려는지, 다음에 무엇을 하면 되는지가 한눈에 보이게 쓴다.
- 짧고 구체적으로. 모호한 "확인", "오류가 발생했습니다", "알 수 없는 문제" 같은 말은 쓰지 않는다.
- 에러는 탓하지 않는다. 무슨 일이 생겼는지 + 해결 방법을 말한다. 기술 용어·에러 코드는 빼거나 뒤로 미룬다.
- 버튼은 동사로 끝나는 행동 문구. 결과가 예측되게 쓴다(예: "확인" 대신 "카드 다시 등록하기").
- 빈 화면은 왜 비었는지 + 첫 행동을 안내한다.
- 한국어는 자연스러운 해요체 기본(톤에 따라 조정), 번역투 금지.
- 영어(en)는 직역이 아니라 영어권 제품에서 실제로 쓸 법한 자연스러운 현지화 문구로 쓴다.

요청 상황: ${query}
톤: ${tone === "auto" ? "상황에 가장 알맞은 톤을 직접 판단" : tone}
만들 유형: ${types.map((t) => `${t}(${TYPE_NAME[t]})`).join(", ")}

각 유형마다 서로 다른 접근의 3가지 안을 만든다(예: 간결형 / 공감형 / 행동 유도형).
필드 규칙:
- label: 안의 성격을 2~6글자로 (예: "간결형")
- title: 핵심 문구. button은 버튼 글자 자체, toast는 알림 문장, 나머지는 제목.
- body: 보조 설명 한두 문장. button은 빈 문자열.
- action: 주 버튼 글자 (button 유형은 빈 문자열, toast는 "되돌리기" 같은 짧은 링크 글자 또는 빈 문자열)
- secondary: 확인창(confirm)의 보조 버튼 글자. 다른 유형은 빈 문자열.
- why: 20년 차 전문가로서 이 안을 고른 이유와 쓰면 좋은 맥락을 한 문장으로.
모든 글자 필드는 ko(한국어)와 en(영어) 두 가지로 채운다.
summary에는 이 상황 전체에 대한 전문가 한마디 조언을 1~2문장으로 쓴다.`;
}

const S = { type: "STRING" };
const BI = { type: "OBJECT", properties: { ko: S, en: S }, required: ["ko", "en"] };
const SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: BI,
    groups: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: Object.keys(TYPE_NAME) },
          options: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { label: BI, title: BI, body: BI, action: BI, secondary: BI, why: BI },
              required: ["label", "title", "body", "action", "secondary", "why"],
            },
          },
        },
        required: ["type", "options"],
      },
    },
  },
  required: ["summary", "groups"],
};

export async function POST(request) {
  // 다른 사이트에서 이 창구를 몰래 쓰지 못하게, 같은 사이트에서 온 요청만 받아요.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ error: "이 창구는 같은 사이트의 화면에서만 쓸 수 있어요" }, 403);
  }

  let input;
  try { input = await request.json(); } catch { return json({ error: "요청 본문이 JSON이 아니에요" }, 400); }

  const query = String(input.query || "").trim();
  const types = Array.isArray(input.types) ? [...new Set(input.types)].filter((t) => t in TYPE_NAME) : [];
  const tone = TONES.includes(input.tone) ? input.tone : "auto";
  if (!query || query.length > 300) return json({ error: "상황은 1~300글자로 적어 주세요" }, 400);
  if (!types.length) return json({ error: "유형을 하나 이상 골라 주세요" }, 400);

  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) return json({ error: "서버에 GEMINI_API_KEY 가 설정되지 않았어요. Vercel 환경 변수를 확인해 주세요." }, 500);

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildPrompt(query, types, tone) }] }],
    generationConfig: { temperature: 0.9, responseMimeType: "application/json", responseSchema: SCHEMA },
  });

  let res, data;
  try {
    // 503(사람이 몰림)이면 잠깐 쉬었다가 두 번까지 다시 불러요
    for (let i = 0; i < 3; i++) {
      res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(90000),
      });
      if (res.status !== 503 || i === 2) break;
      await new Promise((r) => setTimeout(r, 2500 * (i + 1)));
    }
    data = await res.json().catch(() => ({}));
  } catch {
    return json({ error: "Gemini에 연결하지 못했어요 (시간 초과)" }, 504);
  }

  if (!res.ok) {
    // 키 이야기가 섞인 원래 메시지는 그대로 보내지 않고, 상태 번호와 모델 이름만 알려 줘요.
    return json({ error: `Gemini 오류 (${res.status})`, model: MODEL }, res.status);
  }
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Model": MODEL },
  });
}

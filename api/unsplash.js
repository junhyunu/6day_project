// Vercel 서버 함수: Unsplash 사진 검색을 대신 불러 주는 창구예요. (moodboard.html 이 써요)
// Access Key는 Vercel 환경 변수 UNSPLASH_ACCESS_KEY 에만 있고, 브라우저에는 절대 보내지 않아요.
//
// 쓰는 법: /api/unsplash?query=노을&page=1

const BASE = "https://api.unsplash.com/search/photos";
const PER_PAGE = 20;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("query") || "").trim();
  const page = Number(url.searchParams.get("page") || 1);
  if (!query || query.length > 60) return json({ error: "query 는 1~60글자여야 해요" }, 400);
  if (!Number.isInteger(page) || page < 1 || page > 50) return json({ error: "page 는 1~50 사이 숫자여야 해요" }, 400);

  const key = (process.env.UNSPLASH_ACCESS_KEY || "").trim();
  if (!key) return json({ error: "서버에 UNSPLASH_ACCESS_KEY 가 설정되지 않았어요. Vercel 환경 변수를 확인해 주세요." }, 500);

  const upstream = new URL(BASE);
  upstream.searchParams.set("query", query);
  upstream.searchParams.set("page", page);
  upstream.searchParams.set("per_page", PER_PAGE);

  let res, text;
  try {
    res = await fetch(upstream, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      signal: AbortSignal.timeout(8000),
    });
    text = await res.text();
  } catch {
    return json({ error: "Unsplash에 연결하지 못했어요" }, 502);
  }

  const remaining = res.headers.get("X-RateLimit-Remaining") || "";
  if (res.status === 401) return json({ error: "서버의 UNSPLASH_ACCESS_KEY 가 맞지 않아요 (Secret Key가 아니라 Access Key예요)" }, 401);
  if (!res.ok) return json({ error: `Unsplash 오류 (${res.status})`, remaining }, res.status);

  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-RateLimit-Remaining": remaining,
      // 같은 검색어는 1시간 동안 저장해 둔 답을 줘요. 데모 키는 시간당 50번이라 아끼려고요.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}

// Vercel 서버 함수: 서울 버스 API를 대신 불러 주는 창구예요.
// 서비스키는 Vercel 환경 변수 SEOUL_BUS_KEY 에만 있고, 브라우저에는 절대 보내지 않아요.
//
// 쓰는 법: /api/bus?op=station&arsId=01001
//          /api/bus?op=route&strSrch=273
//          /api/bus?op=arrivals&busRouteId=100100118

// https 주소는 서버에서 부르면 응답이 오지 않아요(시간 초과). 공식 문서 주소인 http를 써요.
const BASE = "http://ws.bus.go.kr/api/rest";

// 허락한 주문만 받아요. 아무 주소나 대신 불러 주는 창구가 되지 않게 하려고요.
const OPS = {
  // 정류소정보조회 서비스: 정류소 번호(5자리) → 그 정류소에 오는 버스들
  station: { path: "/stationinfo/getStationByUid", param: "arsId", pattern: /^\d{5}$/, service: "서울특별시_정류소정보조회 서비스" },
  // 노선정보조회 서비스: 버스 번호 → 노선 ID
  route: { path: "/busRouteInfo/getBusRouteList", param: "strSrch", pattern: /^[0-9A-Za-z가-힣-]{1,10}$/, service: "서울특별시_노선정보조회 서비스" },
  // 버스도착정보조회 서비스: 노선 ID → 그 노선 모든 정류소의 도착 예정
  arrivals: { path: "/arrive/getArrInfoByRouteAll", param: "busRouteId", pattern: /^\d{9}$/, service: "서울특별시_버스도착정보조회 서비스" },
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// 공공데이터포털은 키 오류를 XML로 돌려줄 때가 있어서, 사람이 읽을 메시지만 꺼내요.
function xmlMessage(text) {
  const pick = tag => (text.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) || [])[1];
  return pick("returnAuthMsg") || pick("errMsg") || pick("headerMsg") || "알 수 없는 오류";
}

export async function GET(request) {
  const url = new URL(request.url);
  const op = OPS[url.searchParams.get("op")];
  if (!op) return json({ error: "op 는 station, route, arrivals 중 하나여야 해요" }, 400);

  const value = (url.searchParams.get(op.param) || "").trim();
  if (!op.pattern.test(value)) return json({ error: `${op.param} 값이 올바르지 않아요` }, 400);

  let key = process.env.SEOUL_BUS_KEY;
  if (!key) return json({ error: "서버에 SEOUL_BUS_KEY 가 설정되지 않았어요. Vercel 환경 변수를 확인해 주세요." }, 500);
  if (key.includes("%")) key = decodeURIComponent(key); // 인코딩 키(Encoding)를 넣어도 동작하게

  const upstream = new URL(BASE + op.path);
  upstream.searchParams.set("serviceKey", key);
  upstream.searchParams.set(op.param, value);
  upstream.searchParams.set("resultType", "json");

  let res, text;
  try {
    res = await fetch(upstream, { signal: AbortSignal.timeout(8000) });
    text = await res.text();
  } catch {
    return json({ error: "서울시 버스 API에 연결하지 못했어요" }, 502);
  }

  // 응답에 키가 섞여 나가지 않게, 키가 보이면 지워요.
  text = text.split(key).join("***").split(encodeURIComponent(key)).join("***");

  if (text.trimStart().startsWith("<")) {
    return json({ error: `서울시 버스 API 오류: ${xmlMessage(text)}` }, 502);
  }
  // 키가 이 서비스에 등록되지 않았으면, 어떤 서비스를 활용신청해야 하는지 알려 줘요.
  if (res.status === 401 || res.status === 403) {
    return json({ error: `키가 '${op.service}'에 등록되지 않았어요. 공공데이터포털에서 이 서비스를 활용신청해 주세요. (신청 직후면 잠시 뒤 다시)` }, res.status);
  }
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // 같은 주문은 15초 동안 저장해 둔 답을 줘요. 하루 호출 횟수를 아끼려고요.
      "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15",
    },
  });
}

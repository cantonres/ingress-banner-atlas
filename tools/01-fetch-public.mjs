#!/usr/bin/env node
// 用 Bannergress 公开 API 抓取某地的 banner 与 mission（无需登录）。
//
// 本仓库只提供这一步：公开 API 采集。评分、完成次数等会话内数据不在此脚本的采集范围内，
// 本仓库也不提供任何针对 Ingress Intel Map 的采集脚本（这类采集可能违反该服务的使用条款）。
//
// 产出：
//   out/base.json   公开数据全量（banner + mission；不含评分/完成次数等会话内字段）
//
// 用法：
//   node tools/01-fetch-public.mjs
//   node tools/01-fetch-public.mjs --place=taiyuan-5105 --city=太原 --country=China --code=CN --region=APAC
//   node tools/01-fetch-public.mjs --query=太原        # 按名字先查 placeId
//
// 多城市：每个城市各写一份，别让后抓的覆盖先抓的
//   node tools/01-fetch-public.mjs --place=taiyuan-5105 --out=base-taiyuan-5105.json
//   node tools/01-fetch-public.mjs --place=<另一个城市>  --out=base-<另一个城市>.json

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.bannergress.com";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

// 大区（APAC / EMEA / AMER）是档案的聚合键：「大区」筛选器、大区覆盖面板、
// 拼图动态的大区标签都依赖它。Bannergress 的 place 记录**不提供**大区
// （/places 与 /bnrs 都没有该字段，也没有可访问的 OpenAPI），所以只能按国家码映射。
//
// 这里只放有把握的映射；表里没有的国家码**一律要求显式 --region=**，
// 不要用 `|| "APAC"` 兜底——否则缺失映射会被静默归入错误的分区。
const REGION_BY_CODE = {
  // APAC：亚太
  AF: "APAC", AU: "APAC", BD: "APAC", BN: "APAC", CN: "APAC", HK: "APAC",
  ID: "APAC", IN: "APAC", JP: "APAC", KH: "APAC", KR: "APAC", LA: "APAC",
  LK: "APAC", MM: "APAC", MN: "APAC", MO: "APAC", MV: "APAC", MY: "APAC",
  NP: "APAC", NZ: "APAC", PG: "APAC", PH: "APAC", PK: "APAC", SG: "APAC",
  TH: "APAC", TL: "APAC", TW: "APAC", VN: "APAC",
  // EMEA：欧洲 / 中东 / 非洲
  AE: "EMEA", AT: "EMEA", BA: "EMEA", BE: "EMEA", BG: "EMEA", BH: "EMEA",
  CH: "EMEA", CY: "EMEA", CZ: "EMEA", DE: "EMEA", DK: "EMEA", DZ: "EMEA",
  EE: "EMEA", EG: "EMEA", ES: "EMEA", FI: "EMEA", FR: "EMEA", GB: "EMEA",
  GR: "EMEA", HR: "EMEA", HU: "EMEA", IE: "EMEA", IL: "EMEA", IQ: "EMEA",
  IS: "EMEA", IT: "EMEA", JO: "EMEA", KE: "EMEA", KW: "EMEA", LB: "EMEA",
  LT: "EMEA", LU: "EMEA", LV: "EMEA", MA: "EMEA", ME: "EMEA", MK: "EMEA",
  MT: "EMEA", NG: "EMEA", NL: "EMEA", NO: "EMEA", OM: "EMEA", PL: "EMEA",
  PT: "EMEA", QA: "EMEA", RO: "EMEA", RS: "EMEA", RU: "EMEA", SA: "EMEA",
  SE: "EMEA", SI: "EMEA", SK: "EMEA", TN: "EMEA", TR: "EMEA", UA: "EMEA",
  ZA: "EMEA",
  // AMER：美洲
  AR: "AMER", BO: "AMER", BR: "AMER", BS: "AMER", BZ: "AMER", CA: "AMER",
  CL: "AMER", CO: "AMER", CR: "AMER", CU: "AMER", DO: "AMER", EC: "AMER",
  GT: "AMER", HN: "AMER", HT: "AMER", JM: "AMER", MX: "AMER", NI: "AMER",
  PA: "AMER", PE: "AMER", PR: "AMER", PY: "AMER", SV: "AMER", TT: "AMER",
  US: "AMER", UY: "AMER", VE: "AMER",
};

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return response.json();
}

// 列表接口 /places?query= 返回的是**精简记录，没有 parentPlace**（实测只有 10 个字段）；
// 省份 / 国家 / 国家码 / 大区全都从 parentPlace 链上取，只拿列表记录会静默丢掉整条层级
// ——countryCode 变成空串、region 回落成 APAC。所以拿到 id 后必须再取一次完整记录。
async function placeDetail(id) {
  return getJson(`${API}/places/${encodeURIComponent(id)}`).catch(() => null);
}

async function resolvePlace({ place, query }) {
  if (place) {
    const [record] = await getJson(`${API}/places?used=true&query=${encodeURIComponent(place)}&limit=25`);
    const exact = await placeDetail(place);
    if (exact) return exact;
    if (record) return (await placeDetail(record.id)) ?? record;
    throw new Error(`找不到 placeId=${place}`);
  }
  const list = await getJson(`${API}/places?used=true&query=${encodeURIComponent(query)}&limit=10`);
  if (!list.length) {
    // 该接口只按拉丁转写匹配：中文名一律查不到，需改用拉丁转写查询。
    // 中文名一律查不到，所以直接说清楚，别让人以为是自己拼错了。
    const isAscii = /^[\x20-\x7e]+$/.test(query);
    throw new Error(
      `查询 "${query}" 没有结果。\n` +
        (isAscii
          ? `换一个拼写试试；或先到 https://bannergress.com 找到地点，再用 --place=<id> 直取。`
          : `该接口只认拉丁转写，中文名查不到——用 --query=Foshan，不要用 --query=佛山。\n` +
            `若确实要用中文，请先到 https://bannergress.com 找到地点，再用 --place=<id> 直取。`),
    );
  }
  console.log("候选 place：");
  list.forEach((p) =>
    console.log(`  ${p.type.padEnd(28)} ${String(p.longName).padEnd(20)} id=${p.id.padEnd(22)} banners=${p.numberOfBanners}  ${p.formattedAddress}`),
  );
  if (list.length > 1) console.log(`\n默认取第一个：${list[0].id}。若要换，加 --place=<id> 重跑。`);
  const full = await placeDetail(list[0].id);
  if (full) return full;
  console.warn(
    `⚠ 取不到 ${list[0].id} 的完整记录，省份/国家会缺失——请改用 --place=${list[0].id} 重跑。`,
  );
  return list[0];
}

async function fetchBanners(placeId) {
  const attributes = [
    "id", "title", "description", "width", "numberOfMissions", "numberOfSubmittedMissions",
    "numberOfDisabledMissions", "startLatitude", "startLongitude", "formattedAddress",
    "startPlaceId", "picture", "type", "eventStartDate", "eventEndDate",
    "plannedOfflineDate", "lengthMeters", "missions", "owner",
  ].join(",");
  const all = [];
  for (let offset = 0; ; offset += 100) {
    const page = await getJson(
      `${API}/bnrs?placeId=${encodeURIComponent(placeId)}&attributes=${attributes}&limit=100&offset=${offset}`,
    );
    all.push(...page);
    if (page.length < 100) break;
  }
  return all;
}

const absPicture = (p) =>
  typeof p === "string" && p.startsWith("/") ? `${API}${p}` : p ?? null;

async function main() {
  const placeArg = arg("place", "");
  const query = arg("query", "太原");
  const place = await resolvePlace({ place: placeArg, query });

  // --out 让多个城市可以并存（out/base-<placeId>.json），
  // 后抓的城市不会覆盖先抓的。缺省仍是 base.json，单城市流程不变。
  const outFile = arg("out", "base.json");
  const cityOverride = arg("city", "");
  const countryOverride = arg("country", "");
  const codeOverride = arg("code", "");
  const regionOverride = arg("region", "");

  // place 带嵌套 parentPlace：locality → administrative_area_level_1 → country
  const chain = [];
  let node = place;
  let countryNode = null;
  let provinceNode = null;
  while (node) {
    chain.push(node);
    if (node.type === "country") countryNode = node;
    if (node.type === "administrative_area_level_1") provinceNode = node;
    node = node.parentPlace ?? null;
  }

  const city = cityOverride || place.longName || String(place.formattedAddress ?? "").split(",")[0].trim();
  const country = countryOverride || countryNode?.longName || String(place.formattedAddress ?? "").split(",").pop().trim();
  const countryCode = (codeOverride || countryNode?.shortName || "").toUpperCase();
  const province = provinceNode?.longName ?? null;

  // parentPlace 链缺失时 countryCode 会是空串、region 会静默回落成 APAC——
  // 这种「看起来成功、其实缺了一半」的结果比直接报错更危险，所以拦下来。
  // 必须放在大区推断之前：链缺失时 countryCode 是空串，先讲清根因（以及 /places?query=
  // 这个成因）比抛一句「大区推不出来」有用得多。
  if (!countryNode && !countryOverride && !codeOverride) {
    throw new Error(
      `place 记录里没有 country 节点（parentPlace 链缺失），无法确定 country/countryCode。\n` +
      `这通常是取了 /places?query= 的精简记录导致的（该接口不返回 parentPlace）。\n` +
      `请改用 --place=${place.id} 重跑；或显式指定 --country=China --code=CN。`,
    );
  }

  const inferredRegion = REGION_BY_CODE[countryCode];
  if (!regionOverride && !inferredRegion) {
    throw new Error(
      `无法推断大区：countryCode=${countryCode || "(空)"} 不在 REGION_BY_CODE 里。\n` +
      (countryCode ? "" : `（countryCode 为空：只给 --country= 不够，还要补 --code=。）\n`) +
      `大区是档案的聚合键（「大区」筛选器与大区覆盖面板都依赖它），猜错会静默污染数据，\n` +
      `所以这里不兜底。请显式指定 --region=APAC|EMEA|AMER（例如 --region=EMEA）。`,
    );
  }
  const region = regionOverride || inferredRegion;
  // Bannergress 的 place 记录偶有 country 节点写错的情况：某些地点记录的 country
  // 节点与它自己的 formattedAddress 所写的国家不一致。
  // country / countryCode 是档案的聚合键（meta.countryCount、「国家或地区」筛选器、
  // 大区推断都从它来），写错会静默污染数据，所以这里用包围盒做一次客观校验：
  // country 节点的经纬度范围必须与 locality 有交集。国家写错时交集必然为空
  // （Macao lat 22.107~22.217 vs Foshan lat 22.642~23.573）。
  // 校验不过就停下，逼一次显式决定；已手动指定 --country/--code 时只提醒不拦。
  const boxOf = (n) => [
    n.boundaryMinLatitude, n.boundaryMaxLatitude,
    n.boundaryMinLongitude, n.boundaryMaxLongitude,
  ];
  const boxIsComplete = (box) => box.every((v) => typeof v === "number");
  const overlaps = (a, b) => a[0] <= b[1] && a[1] >= b[0] && a[2] <= b[3] && a[3] >= b[2];
  const placeBox = boxOf(place);
  const countryBox = countryNode ? boxOf(countryNode) : null;
  if (
    countryNode &&
    boxIsComplete(placeBox) &&
    boxIsComplete(countryBox) &&
    !overlaps(placeBox, countryBox)
  ) {
    const mismatch = `country 节点是 ${countryNode.longName}/${countryNode.shortName}，` +
      `但经纬度范围与 ${place.longName} 没有交集`;
    if (countryOverride || codeOverride) {
      console.warn(
        `⚠ place 记录的 ${mismatch}——已按你显式指定的 country=${country} code=${countryCode} 继续。`,
      );
    } else {
      throw new Error(
        `place 记录的 ${mismatch}，而 formattedAddress 写的是 "${place.formattedAddress}"。\n` +
        `这多半是 Bannergress 的地点数据写错了（部分地点记录确有此问题）。\n` +
        `country/countryCode 是档案的聚合键，写错会污染 meta.countryCount 与「国家或地区」筛选器，\n` +
        `所以这里不自动猜。确认无误后请显式指定，例如：--country=China --code=CN（必要时再加 --region=APAC）`,
      );
    }
  }

  console.log(`\nplace : ${place.id} (${place.type}) ${place.formattedAddress}`);
  console.log(`层级  : ${chain.map((n) => `${n.longName}(${n.type})`).join(" → ")}`);
  console.log(`地域  : city=${city} province=${province ?? "-"} country=${country} code=${countryCode} region=${region}`);

  const banners = await fetchBanners(place.id);
  const bannersOut = [];
  const guids = [];
  let skipped = 0;

  for (const banner of banners) {
    // Bannergress 的 missions 是**按拼图槽位**给的映射，一个槽位有三种状态：
    //   published —— 已发布，有 Intel GUID
    //   disabled  —— 已下线，有 GUID
    //   待补齐    —— 已提交但未过审，是**彻底的 {}**（连 status 键都没有，已用原始载荷验证）
    // 待补齐的槽位没有任务 GUID，所以从 guids 清单里排除。
    // 但它们确实占一个槽位，必须留在 missions 里：一旦剔除，序号就会整体前移，
    // 与任务标题里自带的序号对不上（占位槽位一旦剔除，后续序号就会错位）。
    const slots = Object.values(banner.missions ?? {});
    const missions = slots.map((mission, index) => {
      const slot = index + 1;
      if (!mission.id) {
        skipped += 1;
        console.warn(`  槽位 ${slot} 待补齐：${banner.id}`);
        return {
          index: slot,
          id: null,
          title: null,
          author: null,
          authorFaction: null,
          rating: null,
          completions: null,
          distanceMeters: null,
          timeMilliseconds: null,
          intelUrl: null,
          status: "pending",
          offline: true,
          picture: null,
        };
      }
      guids.push(mission.id);
      return {
        index: slot,
        id: mission.id,
        title: mission.title ?? "",
        author: null,
        authorFaction: null,
        rating: null,
        completions: null,
        distanceMeters: mission.lengthMeters ?? null,
        timeMilliseconds: mission.averageDurationMilliseconds ?? null,
        intelUrl: `https://intel.ingress.com/mission/${mission.id}`,
        status: mission.status ?? null,
        offline: mission.status === "disabled",
        picture: mission.picture ?? null,
      };
    });

    const published = missions.filter((m) => m.status === "published").length;
    const disabled = missions.filter((m) => m.status === "disabled").length;
    // 待补齐的槽位数：自己数最可靠（占位条目是空对象，没有任何字段可判），
    // 再和 API 的声明值对一次账——不一致就提醒，避免 API 改口径时静默出错。
    const pending = missions.filter((m) => m.status === "pending").length;
    const declaredPending = banner.numberOfSubmittedMissions ?? 0;
    if (pending !== declaredPending) {
      console.warn(
        `  ⚠ ${banner.id} 待补齐槽位：数出来 ${pending}，API 声明 ${declaredPending}，以数出来的为准`,
      );
    }

    bannersOut.push({
      id: banner.id,
      title: banner.title ?? banner.id,
      url: `https://bannergress.com/banner/${encodeURIComponent(banner.id)}`,
      // eventStartDate 是「MD 拼图」的判据：有 = MD 拼图，无 = 玩家自制拼图。
      date: banner.eventStartDate ?? null,
      endDate: banner.eventEndDate ?? null,
      city,
      country,
      countryCode,
      address: banner.formattedAddress ?? "",
      province,
      region,
      lat: banner.startLatitude ?? null,
      lng: banner.startLongitude ?? null,
      // 判定顺序（互斥，越靠前越优先）：
      //   1) 一条已上线的都没有、且一条下线的也没有、但有待补槽 —— 作者刚建好的新拼图，
      //      一条都没过审，算「待补齐」；
      //   2) 一条已上线的都没有 —— 整条不可玩，「offline」比「待补齐」更该优先告知；
      //   3) 有可玩任务但缺槽 —— 「待补齐」（结构性缺口，优先于「部分离线」）；
      //   4) 有任务下线 —— 「部分离线」；
      //   5) 其余 —— 「在线」。
      status:
        published === 0 && disabled === 0 && pending > 0
          ? "pending_slots"
          : published === 0
            ? "offline"
            : pending > 0
              ? "pending_slots"
              : disabled > 0
                ? "partially_offline"
                : "online",
      missionCount: banner.numberOfMissions ?? missions.length,
      onlineMissionCount: published,
      offlineMissionCount: disabled + pending,
      averageRating: null,
      completions: null,
      picture: absPicture(banner.picture),
      // Bannergress 的 type：任务是否必须按顺序完成（sequential / anyOrder）。
      // 注意它**不是**「拼图类型」的判据——只描述顺序约束。
      bannerType: banner.type ?? null,
      plannedOfflineDate: banner.plannedOfflineDate ?? null,
      lengthMeters: banner.lengthMeters ?? null,
      // 拼图描述：含作者写的注意事项与背景介绍。
      description: typeof banner.description === "string" ? banner.description : "",
      // 缩略图网格列数，规范为 1~6。
      width: typeof banner.width === "number" ? banner.width : null,
      // 这两个字段信息量通常很低，
      // 落盘备用，前端不展示。
      numberOfSubmittedMissions: banner.numberOfSubmittedMissions ?? 0,
      numberOfDisabledMissions: banner.numberOfDisabledMissions ?? 0,
      // 该字段在公开 API 上通常恒为 false。形状未在 OpenAPI 中定义，
      // 故原样落盘（false / 单个对象 / 数组），由下游消费方做防御性解析。
      owner: banner.owner ?? false,
      // 必须用 base64url：中文 id 的标准 base64 含 "/"，在 Windows 上会被当成路径分隔符。
      // 前端 tests-js/generated-archive.test.js 同样按 base64url 校验。
      detailPath: `data/events/${Buffer.from(banner.id, "utf8").toString("base64url")}.json`,
      missions,
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "Bannergress public API (/places + /bnrs)",
    place: { id: place.id, type: place.type, formattedAddress: place.formattedAddress },
    location: { city, province, country, countryCode, region },
    banners: bannersOut,
  };

  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, outFile), JSON.stringify(payload), "utf8");

  const totalMissions = bannersOut.reduce((n, b) => n + b.missions.length, 0);
  console.log(`\nbanner : ${bannersOut.length}`);
  console.log(`mission: ${totalMissions}（去重后 ${new Set(guids).size}）`);
  if (skipped) console.log(`待补齐的槽位：${skipped} 个（保留在任务列表里，但没有可用的任务 GUID）`);
  console.log(`已写出: out/${outFile}`);

}

main().catch((error) => {
  console.error(error);
  // 不要用 process.exit(1)：Windows + Node 24 下，stdout/stderr 往往还没写完，
  // 硬退出会撕掉 libuv 的 async handle，于是报
  //   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94
  // 进程以 abort 结束，退出码变成 127 而不是 1（实测 node v24.18.0）。
  // 改成设 exitCode 让事件循环自然收尾：输出保证刷完，退出码也正确。
  process.exitCode = 1;
});

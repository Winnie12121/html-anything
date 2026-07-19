import { describe, expect, it } from "vitest";
import { parseLiepinCsv } from "../liepin";

describe("Liepin CSV parser", () => {
  it("maps search_keyword into the normalized keyword field", () => {
    const records = parseLiepinCsv(
      [
        "job_title,company_name,salary,location,experience,education,job_url,post_date,company_tags,target_company,search_keyword,crawl_time",
        "销售工程师,英飞凌,20-30k,上海,3-5年,本科,,2天前,在线企业,英飞凌,英飞凌,2026-07-19 21:45:00",
      ].join("\n"),
      "2026-07-19T10:00:00.000Z",
    );

    expect(records).toHaveLength(1);
    expect(records[0]?.fields.keyword).toBe("英飞凌");
    expect(records[0]?.fields.company).toBe("英飞凌");
  });
});

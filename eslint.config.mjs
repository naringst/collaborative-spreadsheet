import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 기능(feature) 경계 규칙
// - 다른 feature는 공개 창구(`@/features/<name>`)로만 import한다.
// - feature 내부 파일끼리는 상대 경로로 import한다.
const noDeepFeatureImport = {
  group: ["@/features/*/*"],
  message: "다른 feature는 '@/features/<name>' (index.ts)으로만 import하세요.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": ["error", { patterns: [noDeepFeatureImport] }],
    },
  },
  {
    // sheet는 collab·ai를 몰라야 한다 (의존 방향: ai → sheet ← collab)
    files: ["src/features/sheet/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            noDeepFeatureImport,
            {
              group: ["@/features/collab", "@/features/ai", "@/composition"],
              message: "sheet는 collab·ai·composition에 의존하지 않습니다.",
            },
          ],
        },
      ],
    },
  },
  {
    // collab 코어(provider·presence·persistence)는 Y.Doc만 다루고 시트 도메인을 모른다.
    // 단, 그리드 위에 그리는 collab/ui는 sheet의 공개 API(좌표·오버레이)를 사용할 수 있다.
    files: ["src/features/collab/**"],
    ignores: ["src/features/collab/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            noDeepFeatureImport,
            {
              group: ["@/features/sheet", "@/features/ai", "@/composition"],
              message: "collab은 sheet·ai·composition에 의존하지 않습니다.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;

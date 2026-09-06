# CNC 即时报价 / Instant CNC Quote

Phases 1+2 MVP：上传 STL → 三维预览与几何指标 → 工时/按件人民币报价明细。

## Features · 功能

- **STL 上传**：拖拽或点击，≤25MB，客户端解析（二进制 / ASCII）
- **三维预览**：Three.js + React Three Fiber + drei
- **几何指标**：长×宽×高 (mm)、体积、表面积、三角面数
- **报价引擎**：纯 TypeScript（`src/lib/quote/`），支持
  - **工时**：编程费 + 机床工时×费率 + 材料 + 表面处理
  - **按件**：单价 × 数量（单价摊销编程/调试）
- **币种 / 界面**：CNY ¥ · 中文

## Estimator · 估算说明（近似，非 CAM 循环时间）

1. 解析 STL → 包围盒、体积、表面积
2. `stock = bbox_volume × 1.15`
3. `removed = max(stock − part_volume, 0)`
4. `CutTime_min = (removed_cm³ / MRR[material]) × finish_factor × 1.2 × tolerance_factor`

材料（密度、¥/kg、MRR、机时费率）定义于 `src/lib/quote/config.ts`：
Al6061、Al7075、Steel1045、SS304、BrassC360。

表单：材料、数量 1–1000、公差（标准/精密）、表面（毛坯/阳极氧化/喷砂）、机床（3轴 / 5轴可选加价）、模式（工时/按件）。

报价卡：单价、总价、交期、±置信区间、分项与白话公式。

## Quick start · 本地运行

```bash
npm install
npm test
npm run build
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js App Router · TypeScript · Tailwind CSS · R3F · drei · Vitest

## Out of scope (deferred)

Hybrid pricing、示例 STL 按钮、DFM 面板打磨、支付、账号、STEP、CAM 刀路、订单。

## License

MIT

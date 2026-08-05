# @ziji — Thiết kế kiến trúc & Todo List

## 1. Nguyên tắc thiết kế

Trước khi vẽ cấu trúc, chốt vài nguyên tắc để mọi quyết định sau đó có chỗ dựa:

1. **Core siêu nhỏ, siêu ổn định.** Core chỉ làm 3 việc: lifecycle, DI container, event bus. Không import HTTP, không import DB.
   Core không bao giờ được phép "biết" plugin nào tồn tại.
2. **Mọi thứ là plugin — kể cả HTTP.** Router, WebSocket, Database, Cache đều là plugin chính thức (`@ziji/plugin-*`), không phải
   code lõi. Điều này buộc bạn ăn "dogfood" chính API plugin của mình từ ngày đầu, nên API sẽ tốt hơn.
3. **Convention over configuration, nhưng luôn có escape hatch.** Auto-load theo folder là mặc định, nhưng phải cho phép đăng ký
   thủ công (`server.register(...)`) vì auto-magic quá đà sẽ gây khó debug.
4. **Type-safety là tính năng, không phải afterthought.** Event bus, DI container, context — tất cả phải generic hóa để TypeScript
   suy luận được, không chỉ là string key rời rạc.
5. **Fail fast, fail loud.** Dependency thiếu, circular dependency, plugin lỗi khi `setup()` → phải throw ngay lúc boot với
   message rõ ràng, không âm thầm bỏ qua.
6. **Zero-cost khi không dùng.** Nếu người dùng không cài `@ziji/plugin-websocket`, code đó không được có trong bundle/runtime của
   họ.

---

## 2. Kiến trúc package (monorepo)

```
ziji/
├── packages/
│   │
│   ├── core/                    @ziji/core
│   │   ├── lifecycle            (boot sequence, hooks BOOT→READY→SHUTDOWN)
│   │   ├── container             (DI: register/resolve, singleton/transient/scoped)
│   │   ├── event-bus              (typed emitter, priority, once, wildcard)
│   │   ├── plugin-manager        (setup→ready→reload→dispose, dependency graph)
│   │   └── loader                (quét file, import động, cache, watch)
│   │
│   ├── server/                   @ziji/server  (meta-package, re-export)
│   │
│   ├── config/                   @ziji/config  (load .env, .ts, .json, schema validate bằng zod)
│   ├── logger/                   @ziji/logger  (pino-based, transport, format)
│   ├── errors/                   @ziji/errors  (error classes chuẩn hoá: NotFound, Unauthorized...)
│   │
│   ├── plugin-http/               @ziji/plugin-http     (adapter: Fastify mặc định, Express optional)
│   ├── plugin-router/             @ziji/plugin-router   (file-based routing + decorator routing)
│   ├── plugin-websocket/          @ziji/plugin-websocket (adapter: ws / Socket.IO)
│   ├── plugin-scheduler/          @ziji/plugin-scheduler (cron jobs, distributed lock optional)
│   ├── plugin-database/           @ziji/plugin-database  (adapter: Prisma/Drizzle/Mongoose — KHÔNG tự viết ORM)
│   ├── plugin-cache/               @ziji/plugin-cache    (adapter: memory/LRU/Redis)
│   ├── plugin-security/            @ziji/plugin-security (rate-limit, CORS, helmet-style headers, permission)
│   │
│   ├── extension-discord/         @ziji/extension-discord
│   ├── extension-mqtt/            @ziji/extension-mqtt
│   ├── extension-bullmq/          @ziji/extension-bullmq
│   │
│   ├── cli/                       @ziji/cli  (zi create/dev/build/start/plugin create)
│   ├── devtools/                  @ziji/devtools (hot-reload engine, inspector, CLI debug UI)
│   └── testing/                   @ziji/testing (mock app, mock context, test helpers)
│
├── examples/
│   ├── minimal-api/
│   ├── with-websocket/
│   ├── with-discord-bot/
│   └── full-stack/
│
├── docs/                          (VitePress hoặc Nextra)
├── benchmarks/                    (so sánh với Fastify/Nest thô để track regression)
└── .changeset/                    (versioning độc lập cho từng package)
```

### Vì sao chia vậy?

- **`core` tách khỏi `server`**: `server` chỉ là package tiện lợi cài 1 lần cho người mới, nhưng ai muốn tối ưu bundle có thể cài
  lẻ `@ziji/core` + đúng plugin cần.
- **`plugin-database` không tự viết ORM**: viết ORM riêng là hố đen công sức, không ai dùng framework mới kèm ORM mới. Adapter hóa
  quanh Prisma/Drizzle sẽ được cộng đồng tin tưởng hơn nhiều.
- **`testing` là package riêng ngay từ đầu**: framework không có test utilities tốt thì không ai dùng cho production.

---

## 3. API cốt lõi cần chốt trước (breaking change ở đây là đau nhất)

```ts
// Typed Event Bus — event map tập trung, không phải string rời rạc
interface AppEvents {
  "user:create": { id: string; email: string }
  "server:ready": void
}

app.events.on<AppEvents>("user:create", (payload) => { ... }) // payload tự suy luận type

// DI Container — hỗ trợ token thay vì chỉ class
const LOGGER = createToken<Logger>("logger")
app.container.register(LOGGER, { useClass: PinoLogger })
const logger = app.container.resolve(LOGGER)

// Plugin — dependency graph tường minh, phát hiện circular ngay lúc boot
definePlugin({
  name: "music",
  dependencies: ["logger", "database"],
  async setup(app) { ... },
  async ready(app) { ... },
  async dispose(app) { ... }, // bắt buộc cleanup connection, listener
})
```

---

## 4. Todo List — chia theo giai đoạn

### Giai đoạn 0 — Nền tảng & quyết định

- [ ] Chốt tên package cuối cùng, đăng ký npm scope `@ziji`
- [x] Initialize pnpm workspace and create `packages/core` skeleton
- [ ] Setup monorepo: pnpm workspaces + Turborepo (hoặc Nx)
- [ ] Setup changesets để version độc lập từng package
- [ ] Chốt API design cho: Event Bus, DI Container, Plugin lifecycle (viết RFC/markdown trước khi code)
- [ ] Setup CI: lint, typecheck, test, build cho mọi package trên mỗi PR
- [ ] Chốt coding convention + ESLint/Prettier config chung

### Giai đoạn 1 — Core

- [x] `@ziji/core`: lifecycle boot sequence (BOOT → Config → Plugins → Ready → Shutdown)
- [x] `@ziji/core`: DI container (register/resolve, singleton/transient, token-based)
- [x] `@ziji/core`: typed event bus (on/emit/once, priority HIGH/NORMAL/LOW, wildcard)
- [x] `@ziji/core`: plugin manager — dependency graph + phát hiện circular dependency
- [x] `@ziji/core`: loader — quét folder, import động, cache module
- [ ] Unit test coverage > 90% cho core (core là chỗ không được phép có bug)
- [ ] `@ziji/errors`: bộ error class chuẩn hoá + error handler mặc định
- [ ] `@ziji/config`: load config từ .env/.ts/.json + validate bằng zod, báo lỗi rõ khi thiếu field

- [x] `@ziji/core`: initial package implemented with lifecycle, typed event bus, container, plugin manager, and unit tests

### Giai đoạn 2 — HTTP & Routing

- [ ] `@ziji/plugin-http`: adapter Fastify (mặc định, vì performance + schema validation built-in)
- [ ] `@ziji/plugin-router`: file-based routing (`routes/users.ts` → tự động register)
- [ ] `@ziji/plugin-router`: decorator-based routing (`@Controller`, `@Get`, `@Post`) — optional, dùng `reflect-metadata`
- [ ] Middleware system: global + route-level, thứ tự thực thi rõ ràng, hỗ trợ async
- [ ] Request context (`ctx.request/response/user/plugin/database`) — typed, mở rộng được qua module augmentation
- [ ] `@ziji/plugin-security`: rate-limit, CORS, security headers, permission-based route guard
- [ ] Validate request/response bằng schema (zod hoặc typebox) tích hợp sẵn vào `defineRoute`

### Giai đoạn 3 — Plugin/Extension ecosystem

- [ ] Chuẩn hóa `definePlugin` / `defineExtension` — publish type definitions rõ ràng để bên thứ 3 viết plugin dễ
- [ ] Plugin hot-reload trong dev mode (watch → reload đúng module, không restart toàn server)
- [ ] `@ziji/plugin-database`: adapter Prisma + Drizzle (chọn 1 làm mặc định, còn lại optional)
- [ ] `@ziji/plugin-cache`: adapter Memory/LRU/Redis, interface thống nhất
- [ ] `@ziji/plugin-websocket`: adapter ws + Socket.IO, tích hợp event bus
- [ ] `@ziji/plugin-scheduler`: cron job, tùy chọn distributed lock (Redis) để chạy multi-instance an toàn
- [ ] Extension mẫu: Discord, MQTT, BullMQ — vừa là tính năng vừa là "ví dụ sống" cho người viết extension riêng

### Giai đoạn 4 — Developer Experience

- [ ] `@ziji/cli`: `zi create` (scaffold project từ template), `zi dev`, `zi build`, `zi start`
- [ ] `@ziji/cli`: `zi plugin create`, `zi extension create` (scaffold boilerplate chuẩn)
- [ ] `@ziji/devtools`: log đẹp, có màu, có thể inspect plugin graph, event bus traffic
- [ ] `@ziji/testing`: mock app instance, mock context, helper gọi route trong test không cần khởi HTTP server thật
- [ ] VS Code snippets / extension nhỏ (tùy chọn, boost DX rõ rệt)
- [ ] Error message khi thiếu dependency/circular dependency phải chỉ đúng plugin nào, dòng nào — không chỉ "Error occurred"

### Giai đoạn 5 — Chất lượng & sẵn sàng production

- [ ] Benchmark so với Fastify thô + Nest — công khai kết quả, đừng giấu số xấu
- [ ] Audit memory leak khi hot-reload nhiều lần (dev mode) và khi dispose plugin
- [ ] Graceful shutdown: đảm bảo DB connection, WS connection, job queue đều đóng đúng thứ tự
- [ ] Security review: injection qua config, qua plugin loader (không load file ngoài whitelist)
- [ ] Viết integration test cho từng plugin chính thức, không chỉ unit test core

### Giai đoạn 6 — Docs & Ra mắt

- [ ] Trang docs (VitePress/Nextra): Getting Started, Concepts, API Reference, Plugin Authoring Guide
- [ ] 4 example project trong `examples/` phải build & chạy được bằng CI (tránh docs "chết" theo thời gian)
- [ ] Migration guide nếu có ai đến từ Express/Fastify/Nest
- [ ] Viết bài giới thiệu (blog/Reddit r/node, r/typescript) kèm benchmark thật
- [ ] Chuẩn bị CONTRIBUTING.md + issue template — cộng đồng là thứ giữ framework sống lâu, không phải bạn một mình

---

## 5. Rủi ro cần theo dõi sát

| Rủi ro                        | Vì sao nguy hiểm                                 | Cách giảm thiểu                                                          |
| ----------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Core API đổi liên tục         | Mỗi lần đổi kéo theo mọi plugin phải sửa         | Viết RFC + freeze API core trước khi build plugin thứ 2                  |
| Tự viết ORM/adapter quá nhiều | Công sức lớn, chất lượng khó bằng Prisma/Drizzle | Adapter hóa, không tự chế bánh xe                                        |
| Hot-reload gây leak           | Dev tin tưởng nhưng prod-like bug khó tái hiện   | Test riêng vòng dispose(), chạy reload 1000 lần trong CI kiểm tra memory |
| Docs lỗi thời so với code     | Người dùng mới bỏ cuộc ngay từ bước 1            | Examples chạy trong CI, fail build nếu API đổi mà ví dụ không cập nhật   |

---

_Tài liệu này nên được cập nhật liên tục khi có quyết định kiến trúc mới — coi nó là nguồn sự thật (source of truth) thay vì
Notion/Discord rời rạc._

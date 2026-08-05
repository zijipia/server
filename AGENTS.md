## 1. Dự án này là gì, trong một câu

`@ziji` là một backend framework Node.js/TypeScript theo convention-over-configuration, với core cực nhỏ (lifecycle + DI + event
bus) và mọi tính năng khác (HTTP, WS, DB, cache...) là plugin chính thức — không phải code lõi.

## 2. Việc AI KHÔNG được làm, dù task nào yêu cầu

- **Không thêm logic HTTP/DB/WS vào `packages/core`.** Core không được import bất cứ thứ gì từ `plugin-*`. Nếu một task có vẻ cần
  điều này, đó là dấu hiệu task nên được chia lại, không phải lý do để phá nguyên tắc.
- **Không tự viết ORM hoặc query builder mới.** Mọi thứ liên quan DB phải là adapter quanh Prisma/Drizzle có sẵn, không viết logic
  truy vấn từ đầu.
- **Không đổi shape của Event Bus / DI Container / Plugin lifecycle** (`setup→ready→reload→dispose`) mà không có RFC markdown
  trong `docs/rfcs/` được duyệt trước. Đây là API đông cứng — đổi ở đây vỡ mọi plugin downstream.
- **Không dùng `any` để né lỗi type ở public API.** Nội bộ implementation có thể tạm `any` với `// TODO: type this`, nhưng type
  xuất ra cho người dùng framework phải chính xác.
- **Không thêm dependency runtime mới vào `@ziji/core`** mà không hỏi trước — core phải nhẹ nhất có thể vì nó luôn bị import.

## 3. Cách tiếp cận một task mới

Trước khi viết code, tự trả lời 3 câu hỏi:

1. **Task này thuộc package nào?** Nếu không chắc, dừng lại và hỏi — đừng đoán đại rồi đặt code sai chỗ.
2. **Task này có phá vỡ API đông cứng ở mục 2 không?** Nếu có, cần RFC trước, không code trước.
3. **Có adapter/lib có sẵn làm được việc này chưa?** Ưu tiên adapter hóa thứ có sẵn hơn viết mới từ đầu, trừ khi đó chính là core
   logic của `@ziji`.

## 4. Bản đồ package → trách nhiệm (đọc trước khi sửa file)

| Package       | Được phép chứa                                             | Tuyệt đối không chứa                                  |
| ------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| `core`        | lifecycle, DI container, event bus, plugin manager, loader | HTTP, DB, WS, bất kỳ adapter nào                      |
| `server`      | re-export tiện lợi, không có logic riêng                   | logic thật (nếu có logic thật, nó thuộc package khác) |
| `plugin-http` | adapter Fastify/Express                                    | business logic của app người dùng                     |
| `plugin-router` | file-based + decorator routing                             | validation logic phức tạp (nên gọi ra schema lib) |
| `plugin-database` | adapter Prisma/Drizzle                                    | ORM tự viết |
| `cli` | scaffold, dev/build/start command | logic runtime của server |
| `testing` | mock app/context, test helper | code chỉ dùng nội bộ core (import ngược từ core là sai hướng) |

## 4. Core hiện tại có thể làm gì

`@ziji/core` hiện cung cấp:

- Lifecycle application sequence: `boot()`, `ready`, `shutdown()`
- Typed DI container with token-based registrations, singleton/transient resolution
- Typed event bus with `on`, `once`, `emit`, listener priority, and wildcard support
- Plugin manager with dependency graph resolution and circular dependency detection

| `plugin-router` | file-based + decorator routing | validation logic phức tạp (nên gọi ra schema lib) | | `plugin-database` |
adapter Prisma/Drizzle | ORM tự viết | | `cli` | scaffold, dev/build/start command | logic runtime của server | | `testing` | mock
app/context, test helper | code chỉ dùng nội bộ core (import ngược từ core là sai hướng) |

## 5. Định nghĩa "xong" (Definition of Done) cho mọi PR do AI tạo

Một task chưa xong nếu thiếu bất kỳ điều nào:

- [ ] Có unit test cho logic mới (core yêu cầu > 90% coverage, plugin khác > 70%)
- [ ] Type public API đầy đủ, không `any` lộ ra ngoài
- [ ] Nếu thêm plugin/extension mới → có ví dụ chạy được trong `examples/`
- [ ] Nếu đổi hành vi có thể breaking → đã thêm changeset (`pnpm changeset`) mô tả rõ breaking change
- [ ] Error message khi fail phải nói rõ **plugin nào, field nào, vì sao** — không throw message mơ hồ như "Invalid config"
- [ ] Chạy `pnpm lint && pnpm typecheck && pnpm test` sạch trước khi coi là hoàn thành

## 6. Thứ tự ưu tiên khi có xung đột giữa các mục tiêu

Khi một quyết định kỹ thuật buộc phải đánh đổi, xếp theo thứ tự này:

1. **Đúng với triết lý core-nhỏ / plugin-hóa** (mục 1–2) — không đánh đổi mục này.
2. **An toàn & type-safe** — không hy sinh type-safety để code ngắn hơn.
3. **DX (developer experience)** — error message rõ, API dễ đoán.
4. **Performance** — quan trọng nhưng không được đánh đổi 3 mục trên, trừ khi có benchmark chứng minh chênh lệch nghiêm trọng.
5. **Ít code nhất** — chỉ xếp cuối, vì "ngắn" không phải mục tiêu của framework này.

## 7. Khi AI không chắc

Nếu một yêu cầu (từ người dùng framework hoặc từ task) mâu thuẫn với các nguyên tắc trên, AI nên:

- Nêu rõ mâu thuẫn đó là gì,
- Đề xuất cách làm đúng nguyên tắc,
- Không tự động "linh hoạt" bỏ nguyên tắc để hoàn thành task nhanh hơn.

## 8. Liên kết tài liệu liên quan

- Kiến trúc & todo tổng thể: `todo.md`
- RFC các quyết định API đông cứng: `docs/rfcs/`
- Convention code (lint/format): `.eslintrc`, `.prettierrc` ở root repo

---

_Cập nhật file này ngay khi có quyết định kiến trúc mới — đây là nguồn AI đọc đầu tiên, để nó cũ là để AI làm sai hướng._

---
"@ziji/core": major
---

Update `EventBus.emit()` and `SimpleEventBus.emit()` to accept an optional `payload` parameter. This avoids typescript type errors when emitting events that do not require payload data.
